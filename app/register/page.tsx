"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().split(/\s+/).filter((p) => p.length >= 2).length < 2) {
      setError("Type your first AND last name as on the company roster (example: John Smith).");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Enter your mobile phone number with at least 10 digits.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      setError(data.error || "Registration failed. Try again.");
      return;
    }

    // Log in right away with the phone number.
    const login = await signIn("credentials", {
      identifier: phone,
      password,
      redirect: false,
    });
    setBusy(false);
    if (login?.error) {
      router.push("/login");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-center text-3xl font-black tracking-tight">CSAIS</h1>
      <p className="mt-1 text-center text-sm text-muted">Guard registration</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl border border-line bg-surface p-6">
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="name">
            Full name (first and last) <span className="text-danger">*</span>
          </label>
          <input
            id="name"
            className="w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-lg outline-none focus:border-accent"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Smith"
            autoComplete="name"
            required
          />
          <p className="mt-1 text-xs text-muted">Exactly as on the company roster. One word is not accepted.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="phone">
            Mobile phone number <span className="text-danger">*</span>
          </label>
          <input
            id="phone"
            type="tel"
            className="w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-lg outline-none focus:border-accent"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="416 555 1234"
            autoComplete="tel"
            required
          />
          <p className="mt-1 text-xs text-muted">Dispatch calls this number if you miss a check-in.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="email">
            Email (optional)
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-lg outline-none focus:border-accent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold" htmlFor="password">
            Password (min 8 characters) <span className="text-danger">*</span>
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-lg outline-none focus:border-accent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
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
          {busy ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="font-bold text-accent underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
