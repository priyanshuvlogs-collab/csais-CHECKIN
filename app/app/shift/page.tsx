import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnDutyScreen } from "@/components/guard/OnDutyScreen";

export const dynamic = "force-dynamic";

export default async function ShiftPage() {
  const session = await auth();
  const user = session!.user;

  const activeShift = await prisma.shift.findFirst({
    where: { guardId: user.id, active: true },
    select: { id: true },
  });
  if (!activeShift) redirect("/app");

  return <OnDutyScreen />;
}
