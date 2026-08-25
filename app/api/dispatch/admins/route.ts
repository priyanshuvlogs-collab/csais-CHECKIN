import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isFullName, normalizePhone } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(30).optional().or(z.literal("")),
  password: z.string().min(8).max(200),
});

/** Add a new admin, or promote an existing user (matched by email). */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);

  // Promotion path: { promoteUserId }
  const promote = z.object({ promoteUserId: z.string().min(1) }).safeParse(body);
  if (promote.success) {
    await prisma.user.update({
      where: { id: promote.data.promoteUserId },
      data: { role: "admin" },
    });
    return NextResponse.json({ ok: true, promoted: true });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Name, email and a password of at least 8 characters are required." },
      { status: 400 }
    );
  }
  if (!isFullName(parsed.data.name)) {
    return NextResponse.json({ error: "Enter first and last name." }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  await prisma.user.create({
    data: {
      role: "admin",
      name: parsed.data.name.trim(),
      nameConfirmed: true,
      email,
      phone: phone || null,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      approved: true,
    },
  });
  return NextResponse.json({ ok: true });
}

/** Demote an admin back to guard. The last admin can never be removed. */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = z.object({ id: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "User id required." }, { status: 400 });
  }
  const adminCount = await prisma.user.count({ where: { role: "admin" } });
  if (adminCount <= 1) {
    return NextResponse.json(
      { error: "Cannot remove the last admin. Add another admin first." },
      { status: 400 }
    );
  }
  if (parsed.data.id === user.id) {
    return NextResponse.json(
      { error: "You cannot remove yourself. Ask another admin to do it." },
      { status: 400 }
    );
  }
  await prisma.user.update({
    where: { id: parsed.data.id },
    data: { role: "guard" },
  });
  return NextResponse.json({ ok: true });
}
