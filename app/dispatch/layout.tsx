import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/SignOutButton";
import { NotificationCenter } from "@/components/dispatch/NotificationCenter";

const NAV = [
  { href: "/dispatch", label: "Live board" },
  { href: "/dispatch/missed", label: "Missed" },
  { href: "/dispatch/guards", label: "Guards" },
  { href: "/dispatch/sites", label: "Sites" },
  { href: "/dispatch/report", label: "24h report" },
  { href: "/dispatch/admins", label: "Admins" },
  { href: "/dispatch/help", label: "Help" },
];

export default async function DispatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/app");

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <div className="text-xl font-black tracking-tight">
            CSAIS <span className="text-accent">DISPATCH</span>
          </div>
          <div className="text-xs text-muted">
            Signed in as {session.user.name} — all times America/Toronto
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <SignOutButton />
        </div>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-line pb-3">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-bold hover:border-accent hover:text-accent"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
