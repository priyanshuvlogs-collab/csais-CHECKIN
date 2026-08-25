import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { endShift } from "@/lib/checkin";

export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "guard") {
    return NextResponse.json({ error: "Not signed in as a guard." }, { status: 401 });
  }

  const shift = await prisma.shift.findFirst({
    where: { guardId: user.id, active: true },
  });
  if (!shift) {
    return NextResponse.json({ error: "No active shift to end." }, { status: 404 });
  }

  const ended = await endShift(shift.id, "guard");
  return NextResponse.json({
    ok: true,
    endedAt: ended?.endedAt?.toISOString() ?? new Date().toISOString(),
  });
}
