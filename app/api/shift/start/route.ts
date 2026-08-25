import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notify";
import { fmtDateTime } from "@/lib/time";

const schema = z.object({ siteName: z.string().min(2).max(120) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "guard") {
    return NextResponse.json({ error: "Not signed in as a guard." }, { status: 401 });
  }

  // Hard requirement: full name + phone before any shift.
  if (!user.nameConfirmed || !user.phone) {
    return NextResponse.json(
      { error: "Save your full name and mobile phone number before starting a shift." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Type the site name where you are posted (example: Costco)." },
      { status: 400 }
    );
  }
  const siteName = parsed.data.siteName.trim().replace(/\s+/g, " ");

  const existing = await prisma.shift.findFirst({
    where: { guardId: user.id, active: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an active shift. End it before starting a new one.", shiftId: existing.id },
      { status: 409 }
    );
  }

  // Save the site if it is new (case-insensitive match on existing names).
  const site = await prisma.site.findFirst({
    where: { name: { equals: siteName, mode: "insensitive" } },
  });
  const canonicalName = site?.name ?? siteName;
  if (!site) {
    await prisma.site.create({ data: { name: siteName, active: true } });
  }

  const now = new Date();
  const shift = await prisma.shift.create({
    data: {
      guardId: user.id,
      siteName: canonicalName,
      startedAt: now,
      active: true,
    },
  });

  await notifyAdmins({
    type: "shift_start",
    title: `On duty — ${user.name} at ${canonicalName}`,
    body: `${user.name} started a shift at ${canonicalName} at ${fmtDateTime(now)}. Phone: ${user.phone}.`,
    payload: { shiftId: shift.id, guardId: user.id, site: canonicalName },
  });

  return NextResponse.json({
    ok: true,
    shiftId: shift.id,
    startedAt: shift.startedAt.toISOString(),
  });
}
