import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@csais.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe!123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Seed admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      role: "admin",
      name: "CSAIS Dispatch",
      nameConfirmed: true,
      email,
      passwordHash,
      approved: true,
    },
  });
  console.log(`Seed admin created: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
