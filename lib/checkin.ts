import { randomBytes } from "crypto";
import { prisma } from "./prisma";
import { notifyAdmins } from "./notify";
import { fmtDateTime } from "./time";
import { mapsLink } from "./geo";
import {
  CHECKIN_WINDOW_MS,
  FIRST_PING_DELAY_MS,
  PING_INTERVAL_MS,
} from "./constants";

function newCode(): string {
  return randomBytes(6).toString("hex");
}

/** Create a pending check-in (ping) for a shift and record its deadline. */
export async function sendPing(shiftId: string, opts?: { manual?: boolean }) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { guard: true },
  });
  if (!shift || !shift.active) return null;

  // Never stack pings: one pending check-in per shift at a time.
  const pending = await prisma.checkin.findFirst({
    where: { shiftId, status: "pending" },
  });
  if (pending) return pending;

  const now = new Date();
  const checkin = await prisma.checkin.create({
    data: {
      shiftId,
      guardId: shift.guardId,
      code: newCode(),
      sentAt: now,
      deadlineAt: new Date(now.getTime() + CHECKIN_WINDOW_MS),
      status: "pending",
      extra: opts?.manual ? { manual: true } : undefined,
    },
  });

  if (opts?.manual) {
    await notifyAdmins({
      type: "ping_manual",
      title: `Manual ping sent to ${shift.guard.name}`,
      body: `Manual check-in ping sent to ${shift.guard.name} at ${shift.siteName} at ${fmtDateTime(now)}. Deadline: ${fmtDateTime(checkin.deadlineAt)}.`,
      payload: { checkinId: checkin.id, guardId: shift.guardId },
    });
  }
  return checkin;
}

/** True if this active shift is due for its next ping. */
export function isPingDue(
  shiftStartedAt: Date,
  lastSentAt: Date | null,
  now: Date
): boolean {
  if (!lastSentAt) {
    return now.getTime() >= shiftStartedAt.getTime() + FIRST_PING_DELAY_MS;
  }
  return now.getTime() >= lastSentAt.getTime() + PING_INTERVAL_MS;
}

/** Mark a pending check-in as missed and fire the CALL NOW alert. */
export async function expireCheckin(checkinId: string) {
  const now = new Date();
  // Guard against races with a concurrent upload: only flip if still pending.
  const { count } = await prisma.checkin.updateMany({
    where: { id: checkinId, status: "pending" },
    data: { status: "missed", respondedAt: null },
  });
  if (count === 0) return;

  const checkin = await prisma.checkin.findUnique({
    where: { id: checkinId },
    include: { shift: true, guard: true },
  });
  if (!checkin) return;

  const lastGps = await prisma.location.findFirst({
    where: { shiftId: checkin.shiftId },
    orderBy: { serverAt: "desc" },
  });

  const gpsLine = lastGps
    ? `Last GPS: ${lastGps.lat},${lastGps.lng} at ${fmtDateTime(lastGps.serverAt)}\nMap: ${mapsLink(lastGps.lat, lastGps.lng)}`
    : "Last GPS: none this shift";

  await notifyAdmins({
    type: "checkin_missed",
    title: "CALL NOW — MISSED UPLOAD",
    body: [
      `Name: ${checkin.guard.name}`,
      `Site: ${checkin.shift.siteName}`,
      `Phone: ${checkin.guard.phone ?? "no phone on file"}`,
      `Pinged at: ${fmtDateTime(checkin.sentAt)}`,
      `Missed at: ${fmtDateTime(now)}`,
      gpsLine,
    ].join("\n"),
    payload: {
      checkinId: checkin.id,
      guardId: checkin.guardId,
      shiftId: checkin.shiftId,
      guardName: checkin.guard.name,
      site: checkin.shift.siteName,
      phone: checkin.guard.phone,
      pingedAt: checkin.sentAt.toISOString(),
      missedAt: now.toISOString(),
      lastGps: lastGps
        ? {
            lat: lastGps.lat,
            lng: lastGps.lng,
            at: lastGps.serverAt.toISOString(),
            mapLink: mapsLink(lastGps.lat, lastGps.lng),
          }
        : null,
    },
  });
}

/** End a shift: stop pings, cancel any pending check-in. */
export async function endShift(shiftId: string, reason: "guard" | "auto" | "admin") {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { guard: true },
  });
  if (!shift || !shift.active) return shift;

  const now = new Date();
  await prisma.$transaction([
    prisma.shift.update({
      where: { id: shiftId },
      data: { active: false, endedAt: now },
    }),
    prisma.checkin.updateMany({
      where: { shiftId, status: "pending" },
      data: { status: "cancelled" },
    }),
  ]);

  if (reason === "auto") {
    await notifyAdmins({
      type: "shift_auto_end",
      title: `Shift auto-ended after 12 hours — ${shift.guard.name}`,
      body: `${shift.guard.name} at ${shift.siteName}: shift started ${fmtDateTime(shift.startedAt)} and was automatically ended at ${fmtDateTime(now)} (12 hour limit). Phone: ${shift.guard.phone ?? "n/a"}.`,
      payload: { shiftId, guardId: shift.guardId },
    });
  } else {
    await notifyAdmins({
      type: "shift_end",
      title: `Shift ended — ${shift.guard.name}`,
      body: `${shift.guard.name} ended their shift at ${shift.siteName} at ${fmtDateTime(now)}. Started: ${fmtDateTime(shift.startedAt)}.`,
      payload: { shiftId, guardId: shift.guardId },
    });
  }
  return await prisma.shift.findUnique({ where: { id: shiftId } });
}
