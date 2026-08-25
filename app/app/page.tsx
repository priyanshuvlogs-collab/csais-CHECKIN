import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GuardHome } from "@/components/guard/GuardHome";

export const dynamic = "force-dynamic";

export default async function GuardAppPage() {
  const session = await auth();
  const user = session!.user;

  const activeShift = await prisma.shift.findFirst({
    where: { guardId: user.id, active: true },
    select: { id: true },
  });
  if (activeShift) redirect("/app/shift");

  return (
    <main>
      <GuardHome
        hasPhone={Boolean(user.phone)}
        hasName={user.nameConfirmed}
        currentName={user.name}
        currentPhone={user.phone}
      />
      <p className="mt-6 text-center text-sm">
        <Link href="/app/history" className="text-muted underline">
          View my check-ins from today
        </Link>
      </p>
    </main>
  );
}
