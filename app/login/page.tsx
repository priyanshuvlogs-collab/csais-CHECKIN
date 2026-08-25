"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setError("Wrong email/phone or password. Try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-center text-3xl font-black tracking-tight">CSAIS</h1>
      <p className="mt-1 text-center text-sm text-muted">
        Guard check-in system — log in to continue
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl border border-line bg-surface p-6">
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="identifier">
            Email or mobile phone
          </label>
          <input
            id="identifier"
            className="w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-lg outline-none focus:border-accent"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="admin@csais.local or 4165551234"
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
            className="w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-lg outline-none focus:border-accent"
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
          className="w-full rounded-lg bg-accent px-4 py-4 text-lg font-bold text-black disabled:opacity-50"
        >
          {busy ? "Logging in..." : "Log in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        New guard?{" "}
        <Link href="/register" className="font-bold text-accent underline">
          Register here
        </Link>
      </p>
    </main>
  );
}
