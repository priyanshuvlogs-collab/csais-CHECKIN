"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dispatch", label: "Live board" },
  { href: "/dispatch/missed", label: "Missed" },
  { href: "/dispatch/security", label: "Security" },
  { href: "/dispatch/guards", label: "Guards" },
  { href: "/dispatch/sites", label: "Sites" },
  { href: "/dispatch/report", label: "24h report" },
  { href: "/dispatch/admins", label: "Admins" },
  { href: "/dispatch/help", label: "Help" },
];

export function DispatchNav() {
  const pathname = usePathname();
  return (
    <nav className="scrollbar-none -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 pb-0">
      {NAV.map((item) => {
        const active =
          item.href === "/dispatch"
            ? pathname === "/dispatch" || pathname.startsWith("/dispatch/checkins")
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2.5 text-sm font-bold transition-colors ${
              active
                ? "border-accent bg-surface text-accent"
                : "border-transparent text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
