import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendPing } from "@/lib/checkin";

const schema = z.object({ shiftId: z.string().min(1) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "shiftId required." }, { status: 400 });
  }

  const shift = await prisma.shift.findUnique({ where: { id: parsed.data.shiftId } });
  if (!shift || !shift.active) {
    return NextResponse.json({ error: "Shift not found or already ended." }, { status: 404 });
  }

  const existing = await prisma.checkin.findFirst({
    where: { shiftId: shift.id, status: "pending" },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Guard already has a pending check-in.", checkinId: existing.id },
      { status: 409 }
    );
  }

  const checkin = await sendPing(shift.id, { manual: true });
  return NextResponse.json({ ok: true, checkinId: checkin?.id });
}
