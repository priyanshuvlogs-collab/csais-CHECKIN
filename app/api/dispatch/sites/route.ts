import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = z.object({ name: z.string().min(2).max(120) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Site name must be at least 2 characters." }, { status: 400 });
  }
  const name = parsed.data.name.trim().replace(/\s+/g, " ");
  const existing = await prisma.site.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    if (!existing.active) {
      await prisma.site.update({ where: { id: existing.id }, data: { active: true } });
      return NextResponse.json({ ok: true, reactivated: true });
    }
    return NextResponse.json({ error: "Site already exists." }, { status: 409 });
  }
  await prisma.site.create({ data: { name, active: true } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = z.object({ id: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Site id required." }, { status: 400 });
  }
  // Deactivate instead of hard-delete so history keeps its site names.
  await prisma.site.update({ where: { id: parsed.data.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
