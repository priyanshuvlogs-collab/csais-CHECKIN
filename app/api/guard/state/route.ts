import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { FIRST_PING_DELAY_MS, PING_INTERVAL_MS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Polled by the guard screen every few seconds. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "guard") {
    return NextResponse.json({ error: "Not signed in as a guard." }, { status: 401 });
  }

  const shift = await prisma.shift.findFirst({
    where: { guardId: user.id, active: true },
    include: {
      checkins: { orderBy: { sentAt: "desc" }, take: 5 },
    },
  });

  const now = new Date();

  if (!shift) {
    return NextResponse.json({
      serverNow: now.toISOString(),
      profile: { name: user.name, phone: user.phone, nameConfirmed: user.nameConfirmed },
      shift: null,
    });
  }

  const last = shift.checkins[0] ?? null;
  const pending = last?.status === "pending" ? last : null;

  // When the next ping is expected (for the countdown card).
  const nextPingAt = last
    ? new Date(last.sentAt.getTime() + PING_INTERVAL_MS)
    : new Date(shift.startedAt.getTime() + FIRST_PING_DELAY_MS);

  return NextResponse.json({
    serverNow: now.toISOString(),
    profile: { name: user.name, phone: user.phone, nameConfirmed: user.nameConfirmed },
    shift: {
      id: shift.id,
      siteName: shift.siteName,
      startedAt: shift.startedAt.toISOString(),
      nextPingAt: pending ? null : nextPingAt.toISOString(),
    },
    pendingCheckin: pending
      ? {
          id: pending.id,
          sentAt: pending.sentAt.toISOString(),
          deadlineAt: pending.deadlineAt.toISOString(),
        }
      : null,
    lastCheckin: last
      ? { id: last.id, status: last.status, sentAt: last.sentAt.toISOString(), respondedAt: last.respondedAt?.toISOString() ?? null }
      : null,
  });
}
