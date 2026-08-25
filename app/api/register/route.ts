import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isFullName, normalizePhone } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(1).max(30),
  email: z.string().email().max(200).optional().or(z.literal("")),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Check the form: name, phone and a password of at least 8 characters are required." },
      { status: 400 }
    );
  }
  const { name, email, password } = parsed.data;

  if (!isFullName(name)) {
    return NextResponse.json(
      { error: "Type your first AND last name as on the company roster (example: John Smith)." },
      { status: 400 }
    );
  }

  const phone = normalizePhone(parsed.data.phone);
  if (phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json(
      { error: "Enter a valid mobile phone number with at least 10 digits." },
      { status: 400 }
    );
  }

  const phoneTaken = await prisma.user.findUnique({ where: { phone } });
  if (phoneTaken) {
    return NextResponse.json(
      { error: "This phone number is already registered. Log in instead." },
      { status: 409 }
    );
  }
  const normalizedEmail = email ? email.toLowerCase() : null;
  if (normalizedEmail) {
    const emailTaken = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (emailTaken) {
      return NextResponse.json(
        { error: "This email is already registered. Log in instead." },
        { status: 409 }
      );
    }
  }

  // The very first user in the system becomes the admin.
  const userCount = await prisma.user.count();
  const role = userCount === 0 ? "admin" : "guard";

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      role,
      name: name.trim().replace(/\s+/g, " "),
      nameConfirmed: true,
      phone,
      email: normalizedEmail,
      passwordHash,
      approved: true,
    },
  });

  return NextResponse.json({ ok: true, role });
}
