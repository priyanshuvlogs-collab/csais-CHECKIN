import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { NotificationCenter } from "@/components/dispatch/NotificationCenter";
import { DispatchNav } from "@/components/dispatch/DispatchNav";

export default async function DispatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/app");

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-12">
      <header className="sticky top-0 z-40 -mx-4 mb-1 border-b border-line bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent font-black text-black">
              C
            </span>
            <div>
              <div className="text-lg font-black leading-tight tracking-tight">
                CSAIS <span className="text-accent">DISPATCH</span>
              </div>
              <div className="text-xs text-muted">
                {session.user.name} · all times America/Toronto
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <SignOutButton />
          </div>
        </div>
      </header>
      <DispatchNav />
      {children}
    </div>
  );
}
