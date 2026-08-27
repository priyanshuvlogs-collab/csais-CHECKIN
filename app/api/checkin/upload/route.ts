import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sha256, storeMedia, verdictForUpload } from "@/lib/media";
import { notifyAdmins } from "@/lib/notify";
import { fmtDateTime } from "@/lib/time";
import {
  checkClockSkew,
  checkShiftDeviceIntegrity,
  getRequestContext,
  raiseFlag,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "guard") {
    return NextResponse.json({ error: "Not signed in as a guard." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const checkinId = String(form.get("checkinId") || "");
  const captureMethod = String(form.get("captureMethod") || "");
  const durationRaw = form.get("durationSeconds");
  const durationSeconds =
    durationRaw != null && durationRaw !== "" ? Number(durationRaw) : null;
  const lastModifiedRaw = form.get("clientLastModified");
  const clientLastModified =
    lastModifiedRaw != null && lastModifiedRaw !== "" ? Number(lastModifiedRaw) : null;
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No media file received. Take a photo or video with the camera." }, { status: 400 });
  }

  const checkin = await prisma.checkin.findUnique({
    where: { id: checkinId },
    include: { shift: true },
  });
  if (!checkin || checkin.guardId !== user.id) {
    return NextResponse.json({ error: "Check-in not found." }, { status: 404 });
  }
  if (checkin.status === "ok" || checkin.status === "late") {
    return NextResponse.json({ error: "This check-in is already complete." }, { status: 409 });
  }
  if (checkin.status === "cancelled") {
    return NextResponse.json({ error: "This check-in was cancelled." }, { status: 409 });
  }
  const wasMissed = checkin.status === "missed";

  // Anti-cheat: same device/IP as shift start? Device clock sane?
  const ctx = getRequestContext(req);
  await checkShiftDeviceIntegrity(checkin.shiftId, user.id, ctx, checkin.id);
  const clientNowRaw = form.get("clientNow");
  if (clientNowRaw) {
    await checkClockSkew({
      guardId: user.id,
      shiftId: checkin.shiftId,
      checkinId: checkin.id,
      clientTimeMs: Number(clientNowRaw),
      source: "check-in upload",
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const isVideo = mime.startsWith("video/");

  const verdict = await verdictForUpload({
    buffer,
    mime,
    captureMethod,
    isVideo,
    durationSeconds,
    clientLastModified,
    pingSentAt: checkin.sentAt,
  });
  if (!verdict.ok) {
    // Record the ATTEMPT so dispatch can see who tries to cheat.
    if (verdict.flagType) {
      await raiseFlag({
        guardId: user.id,
        shiftId: checkin.shiftId,
        checkinId: checkin.id,
        type: verdict.flagType,
        severity: "warn",
        notify: true,
        detail: `Rejected upload during check-in: ${verdict.reason}`,
        meta: { captureMethod, mime, fileName: file.name, ip: ctx.ip },
      });
    }
    return NextResponse.json({ error: verdict.reason }, { status: 422 });
  }

  // Reject any file we have seen before (reused/forwarded media).
  const hash = sha256(buffer);
  const reused = await prisma.checkin.findFirst({
    where: { mediaHash: hash, id: { not: checkin.id } },
    select: { id: true },
  });
  if (reused) {
    await prisma.checkin.update({
      where: { id: checkin.id },
      data: { isForwarded: true },
    });
    await raiseFlag({
      guardId: user.id,
      shiftId: checkin.shiftId,
      checkinId: checkin.id,
      type: "reused_media_rejected",
      severity: "warn",
      notify: true,
      detail: `Tried to reuse a previously-uploaded file for this check-in (same file hash as check-in ${reused.id}).`,
      meta: { hash, previousCheckinId: reused.id, ip: ctx.ip },
    });
    return NextResponse.json(
      { error: "This exact file was already used for another check-in. Take a NEW photo or video now." },
      { status: 422 }
    );
  }

  const mediaPath = await storeMedia(buffer, hash, mime);
  const now = new Date();
  const responseSeconds = Math.round((now.getTime() - checkin.sentAt.getTime()) / 1000);
  const onTime = now.getTime() <= checkin.deadlineAt.getTime() && !wasMissed;
  const status = onTime ? "ok" : "late";

  // Only complete if nobody flipped the row meanwhile (race with the expiry worker).
  const { count } = await prisma.checkin.updateMany({
    where: { id: checkin.id, status: wasMissed ? "missed" : "pending" },
    data: {
      status,
      respondedAt: now,
      mediaType: mime,
      mediaPath,
      mediaHash: hash,
      responseSeconds,
      source: verdict.source,
      extra: {
        captureMethod,
        durationSeconds,
        clientLastModified,
        takenAt: verdict.takenAt ? verdict.takenAt.toISOString() : null,
        fileName: file.name,
        fileSize: buffer.length,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        deviceId: ctx.deviceId,
      },
    },
  });
  if (count === 0) {
    // Expiry worker won the race — record as late instead.
    await prisma.checkin.update({
      where: { id: checkin.id },
      data: {
        status: "late",
        respondedAt: now,
        mediaType: mime,
        mediaPath,
        mediaHash: hash,
        responseSeconds,
        source: verdict.source,
      },
    });
  }

  const finalStatus = count === 0 ? "late" : status;
  if (finalStatus === "late") {
    await notifyAdmins({
      type: "checkin_late",
      title: `Late check-in received — ${user.name}`,
      body: `${user.name} at ${checkin.shift.siteName} responded LATE at ${fmtDateTime(now)} (pinged ${fmtDateTime(checkin.sentAt)}, deadline ${fmtDateTime(checkin.deadlineAt)}). Phone: ${user.phone ?? "n/a"}. Media source: ${verdict.source}.`,
      payload: { checkinId: checkin.id, guardId: user.id },
    });
  }

  return NextResponse.json({
    ok: true,
    status: finalStatus,
    source: verdict.source,
    respondedAt: now.toISOString(),
    message:
      finalStatus === "ok"
        ? verdict.source === "unverified"
          ? "Check-in received. It is marked UNVERIFIED — next time prefer a short live video."
          : "Check-in complete. You are confirmed awake."
        : "Received, but AFTER the deadline. Dispatch was already alerted — expect a call.",
  });
}
