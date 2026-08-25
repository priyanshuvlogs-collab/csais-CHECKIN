"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signIn("credentials", {
      identifier: email,
      password,
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setError("Wrong email or password. Try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-center text-3xl font-black tracking-tight">
        CSAIS <span className="text-warn">DISPATCH</span>
      </h1>
      <p className="mt-1 text-center text-sm text-muted">
        Admin panel — dispatch and supervisors only
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 space-y-4 rounded-xl border-2 border-warn/50 bg-surface p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="email">
            Admin email
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-lg outline-none focus:border-warn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@csais.local"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-lg outline-none focus:border-warn"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error && (
          <p className="rounded-lg border border-danger bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-warn px-4 py-4 text-lg font-bold text-black disabled:opacity-50"
        >
          {busy ? "Logging in..." : "Log in to dispatch"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Are you a guard?{" "}
        <Link href="/login" className="font-bold text-accent underline">
          Use the guard login
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-muted">
        Admin accounts are created by an existing admin under Dispatch → Admins.
      </p>
    </main>
  );
}
