import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { haversineMeters, mapsLink } from "@/lib/geo";
import { notifyAdmins } from "@/lib/notify";
import { fmtDateTime } from "@/lib/time";
import { MOVE_NOTIFY_METERS } from "@/lib/constants";
import {
  checkGpsIntegrity,
  checkShiftDeviceIntegrity,
  getRequestContext,
} from "@/lib/security";

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable().optional(),
  heading: z.number().nullable().optional(),
  isLive: z.boolean().default(false),
  livePeriod: z.number().int().positive().nullable().optional(),
  clientAt: z.string().datetime(),
  checkinId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "guard") {
    return NextResponse.json({ error: "Not signed in as a guard." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid GPS data." }, { status: 400 });
  }
  const d = parsed.data;

  const shift = await prisma.shift.findFirst({
    where: { guardId: user.id, active: true },
  });
  if (!shift) {
    return NextResponse.json({ error: "No active shift. Start a shift first." }, { status: 400 });
  }

  // Anti-cheat: same device/IP as shift start; spoof heuristics below.
  const ctx = getRequestContext(req);
  await checkShiftDeviceIntegrity(shift.id, user.id, ctx, d.checkinId ?? null);

  const previous = await prisma.location.findFirst({
    where: { shiftId: shift.id },
    orderBy: { serverAt: "desc" },
  });

  await checkGpsIntegrity({
    guardId: user.id,
    shiftId: shift.id,
    checkinId: d.checkinId ?? null,
    lat: d.lat,
    lng: d.lng,
    accuracy: d.accuracy ?? null,
    clientAt: new Date(d.clientAt),
    previous: previous
      ? { lat: previous.lat, lng: previous.lng, serverAt: previous.serverAt }
      : null,
  });
  const lastNotified = await prisma.location.findFirst({
    where: { shiftId: shift.id, extra: { path: ["notified"], equals: true } },
    orderBy: { serverAt: "desc" },
  });

  const movedMeters = previous
    ? haversineMeters(previous.lat, previous.lng, d.lat, d.lng)
    : null;
  const movedSinceNotified = lastNotified
    ? haversineMeters(lastNotified.lat, lastNotified.lng, d.lat, d.lng)
    : null;

  const isFirstOfShift = !previous;
  const shouldNotify =
    isFirstOfShift ||
    (movedSinceNotified != null && movedSinceNotified >= MOVE_NOTIFY_METERS);

  const now = new Date();
  const location = await prisma.location.create({
    data: {
      guardId: user.id,
      shiftId: shift.id,
      checkinId: d.checkinId || null,
      lat: d.lat,
      lng: d.lng,
      accuracy: d.accuracy ?? null,
      heading: d.heading ?? null,
      isLive: d.isLive,
      livePeriod: d.livePeriod ?? null,
      clientAt: new Date(d.clientAt),
      serverAt: now,
      extra: {
        movedMeters,
        movedSinceNotified,
        notified: shouldNotify,
        mode: d.isLive ? "live-watch" : "one-time",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        deviceId: ctx.deviceId,
      },
    },
  });

  if (shouldNotify) {
    const kind = d.isLive ? "live location" : "one-time GPS pin";
    await notifyAdmins({
      type: isFirstOfShift ? "gps_first" : "gps_moved",
      title: isFirstOfShift
        ? `First GPS this shift — ${user.name}`
        : `Moved ${movedSinceNotified} m — ${user.name}`,
      body: [
        `${user.name} at ${shift.siteName} sent a ${kind}.`,
        `Position: ${d.lat},${d.lng} (accuracy ${d.accuracy != null ? Math.round(d.accuracy) + " m" : "unknown"})`,
        `Client time: ${fmtDateTime(d.clientAt)} | Server time: ${fmtDateTime(now)}`,
        movedSinceNotified != null ? `Moved since last alert: ${movedSinceNotified} m` : "",
        `Map: ${mapsLink(d.lat, d.lng)}`,
      ]
        .filter(Boolean)
        .join("\n"),
      payload: {
        guardId: user.id,
        shiftId: shift.id,
        locationId: location.id,
        lat: d.lat,
        lng: d.lng,
        mapLink: mapsLink(d.lat, d.lng),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    serverAt: now.toISOString(),
    movedMeters,
    message: "GPS saved. Remember: GPS does NOT complete a check-in — the live photo/video is still required.",
  });
}
