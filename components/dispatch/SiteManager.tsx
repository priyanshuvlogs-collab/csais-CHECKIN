"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddSiteForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/dispatch/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not add the site.");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-start gap-2">
      <input
        className="min-w-52 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 outline-none focus:border-accent"
        placeholder="New site name (example: Costco)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={2}
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 font-bold text-black disabled:opacity-50"
      >
        {busy ? "Adding..." : "Add site"}
      </button>
      {error && <p className="w-full text-sm font-semibold text-danger">{error}</p>}
    </form>
  );
}

export function RemoveSiteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Deactivate site "${name}"? History keeps the name.`)) return;
    setBusy(true);
    await fetch("/api/dispatch/sites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="rounded border border-danger px-2 py-1 text-xs font-bold text-danger disabled:opacity-50"
    >
      {busy ? "..." : "Deactivate"}
    </button>
  );
}
