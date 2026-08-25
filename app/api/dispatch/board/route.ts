import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { FIRST_PING_DELAY_MS, PING_INTERVAL_MS } from "@/lib/constants";
import { mapsLink } from "@/lib/geo";

export const dynamic = "force-dynamic";

/** Live duty board data. Polled by dispatch every 5 seconds. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const shifts = await prisma.shift.findMany({
    where: { active: true },
    include: {
      guard: { select: { id: true, name: true, phone: true } },
      checkins: { orderBy: { sentAt: "desc" }, take: 1 },
      locations: { orderBy: { serverAt: "desc" }, take: 1 },
    },
    orderBy: { startedAt: "asc" },
  });

  const waiting: unknown[] = [];
  const onDuty: unknown[] = [];

  for (const s of shifts) {
    const last = s.checkins[0] ?? null;
    const gps = s.locations[0]
      ? {
          lat: s.locations[0].lat,
          lng: s.locations[0].lng,
          accuracy: s.locations[0].accuracy,
          isLive: s.locations[0].isLive,
          at: s.locations[0].serverAt.toISOString(),
          mapLink: mapsLink(s.locations[0].lat, s.locations[0].lng),
        }
      : null;

    const base = {
      shiftId: s.id,
      guardId: s.guard.id,
      name: s.guard.name,
      phone: s.guard.phone,
      site: s.siteName,
      startedAt: s.startedAt.toISOString(),
      gps,
    };

    if (last?.status === "pending") {
      waiting.push({
        ...base,
        checkinId: last.id,
        pingedAt: last.sentAt.toISOString(),
        deadlineAt: last.deadlineAt.toISOString(),
      });
    } else {
      const nextPingAt = last
        ? new Date(last.sentAt.getTime() + PING_INTERVAL_MS)
        : new Date(s.startedAt.getTime() + FIRST_PING_DELAY_MS);
      onDuty.push({
        ...base,
        lastCheckinStatus: last?.status ?? null,
        lastCheckinAt: last?.respondedAt?.toISOString() ?? null,
        nextPingAt: nextPingAt.toISOString(),
      });
    }
  }

  // Missed check-ins from the last 24h that were never resolved with media.
  const missedCheckins = await prisma.checkin.findMany({
    where: { status: "missed", sentAt: { gte: dayAgo } },
    include: {
      guard: { select: { id: true, name: true, phone: true } },
      shift: {
        include: { locations: { orderBy: { serverAt: "desc" }, take: 1 } },
      },
    },
    orderBy: { deadlineAt: "desc" },
  });

  const missed = missedCheckins.map((c) => {
    const loc = c.shift.locations[0] ?? null;
    return {
      checkinId: c.id,
      guardId: c.guard.id,
      name: c.guard.name,
      phone: c.guard.phone,
      site: c.shift.siteName,
      shiftActive: c.shift.active,
      pingedAt: c.sentAt.toISOString(),
      missedAt: c.deadlineAt.toISOString(),
      gps: loc
        ? {
            lat: loc.lat,
            lng: loc.lng,
            at: loc.serverAt.toISOString(),
            mapLink: mapsLink(loc.lat, loc.lng),
          }
        : null,
    };
  });

  return NextResponse.json({ serverNow: now.toISOString(), waiting, missed, onDuty });
}
