import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";

export default async function GuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  // Admins have their own console; guards never see admin nav and vice versa.
  if (session.user.role !== "guard") redirect("/dispatch");

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-10">
      <header className="flex items-center justify-between py-4">
        <div>
          <div className="text-xl font-black tracking-tight">CSAIS</div>
          <div className="text-xs text-muted">Guard check-in</div>
        </div>
        <SignOutButton />
      </header>
      {children}
    </div>
  );
}
