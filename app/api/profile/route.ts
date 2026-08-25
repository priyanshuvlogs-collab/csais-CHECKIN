import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isFullName, normalizePhone } from "@/lib/auth";

const schema = z.object({
  name: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
});

/** Guards use this to complete the mandatory phone + full-name steps. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const data: { name?: string; nameConfirmed?: boolean; phone?: string } = {};

  if (parsed.data.name !== undefined) {
    if (!isFullName(parsed.data.name)) {
      return NextResponse.json(
        { error: "Type your first AND last name (example: John Smith). One word is not enough." },
        { status: 400 }
      );
    }
    data.name = parsed.data.name.trim().replace(/\s+/g, " ");
    data.nameConfirmed = true;
  }

  if (parsed.data.phone !== undefined) {
    const phone = normalizePhone(parsed.data.phone);
    if (phone.replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        { error: "Enter a valid mobile phone number with at least 10 digits." },
        { status: 400 }
      );
    }
    const taken = await prisma.user.findFirst({
      where: { phone, id: { not: user.id } },
    });
    if (taken) {
      return NextResponse.json(
        { error: "This phone number is already used by another account." },
        { status: 409 }
      );
    }
    data.phone = phone;
  }

  await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
}
