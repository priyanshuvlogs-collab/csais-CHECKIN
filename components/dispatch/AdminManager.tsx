"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddAdminForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/dispatch/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not add the admin.");
      return;
    }
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-2">
      <input
        className="rounded-lg border border-line bg-surface-2 px-3 py-2 outline-none focus:border-accent"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        type="email"
        className="rounded-lg border border-line bg-surface-2 px-3 py-2 outline-none focus:border-accent"
        placeholder="Email (login)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="tel"
        className="rounded-lg border border-line bg-surface-2 px-3 py-2 outline-none focus:border-accent"
        placeholder="Phone (optional)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <input
        type="password"
        className="rounded-lg border border-line bg-surface-2 px-3 py-2 outline-none focus:border-accent"
        placeholder="Password (min 8 chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
      />
      {error && (
        <p className="text-sm font-semibold text-danger sm:col-span-2">{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 font-bold text-black disabled:opacity-50 sm:col-span-2"
      >
        {busy ? "Adding..." : "Add admin"}
      </button>
    </form>
  );
}

export function RemoveAdminButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirm(`Remove admin access for ${name}? They become a guard account.`)) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/dispatch/admins", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not remove.");
      return;
    }
    router.refresh();
  }

  return (
    <span>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded border border-danger px-2 py-1 text-xs font-bold text-danger disabled:opacity-50"
      >
        {busy ? "..." : "Remove admin"}
      </button>
      {error && <span className="ml-2 text-xs text-danger">{error}</span>}
    </span>
  );
}
