"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded border border-line bg-surface-2 px-3 py-1.5 text-sm font-semibold text-muted hover:text-foreground"
    >
      Sign out
    </button>
  );
}
