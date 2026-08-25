import { redirect } from "next/navigation";
import Link from "next/link";
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
          <div className="text-xl font-black tracking-tight">
            CSAIS <span className="text-accent">GUARD</span>
          </div>
          <div className="text-xs text-muted">Guard panel</div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/help"
            className="rounded border border-line bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-foreground"
          >
            Help
          </Link>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
