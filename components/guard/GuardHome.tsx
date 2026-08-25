"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  hasPhone: boolean;
  hasName: boolean;
  currentName: string;
  currentPhone: string | null;
};

/**
 * The single guided guard screen: shows ONLY the next required step.
 * Step 1: phone. Step 2: full name. Step 3: start shift (type site name).
 */
export function GuardHome({ hasPhone, hasName, currentName, currentPhone }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState(currentName);
  const [siteName, setSiteName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveProfile(patch: { phone?: string; name?: string }) {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save. Try again.");
      return;
    }
    router.refresh();
  }

  async function startShift(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (siteName.trim().length < 2) {
      setError("Type the site name where you are posted. Example: Costco.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/shift/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteName }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not start the shift. Try again.");
      if (data.shiftId) router.push("/app/shift");
      return;
    }
    router.push("/app/shift");
  }

  if (!hasPhone) {
    return (
      <section className="rounded-xl border border-line bg-surface p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-warn">Step 1 of 3</p>
        <h2 className="mt-1 text-2xl font-black">Enter your mobile number</h2>
        <p className="mt-2 text-muted">
          Dispatch calls this number if you miss a check-in. You cannot start a
          shift without it.
        </p>
        <input
          type="tel"
          className="mt-4 w-full rounded-lg border border-line bg-surface-2 px-4 py-4 text-xl outline-none focus:border-accent"
          placeholder="416 555 1234"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
        {error && <ErrorBox text={error} />}
        <button
          type="button"
          disabled={busy}
          onClick={() => saveProfile({ phone })}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-4 text-xl font-bold text-black disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save phone number"}
        </button>
      </section>
    );
  }

  if (!hasName) {
    return (
      <section className="rounded-xl border border-line bg-surface p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-warn">Step 2 of 3</p>
        <h2 className="mt-1 text-2xl font-black">Type your full name</h2>
        <p className="mt-2 text-muted">
          First AND last name, exactly as on the company roster. Example: John
          Smith. One word will be rejected.
        </p>
        <input
          className="mt-4 w-full rounded-lg border border-line bg-surface-2 px-4 py-4 text-xl outline-none focus:border-accent"
          placeholder="John Smith"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
        {error && <ErrorBox text={error} />}
        <button
          type="button"
          disabled={busy}
          onClick={() => saveProfile({ name })}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-4 text-xl font-bold text-black disabled:opacity-50"
        >
          {busy ? "Saving..." : "Save full name"}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-6">
      <p className="text-sm font-bold uppercase tracking-wide text-accent">Step 3 of 3</p>
      <h2 className="mt-1 text-2xl font-black">Start your shift</h2>
      <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3 text-sm">
        <p><span className="text-muted">Name:</span> <strong>{currentName}</strong></p>
        <p><span className="text-muted">Phone:</span> <strong>{currentPhone}</strong></p>
      </div>
      <p className="mt-4 text-muted">
        When you arrive on post: type the site name below, then tap Start
        shift. The start time is recorded automatically.
      </p>
      <form onSubmit={startShift}>
        <label htmlFor="site" className="mt-4 block text-sm font-semibold">
          Site name (example: Costco)
        </label>
        <input
          id="site"
          className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-4 py-4 text-xl outline-none focus:border-accent"
          placeholder="Costco"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          required
        />
        {error && <ErrorBox text={error} />}
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-5 text-2xl font-black text-black disabled:opacity-50"
        >
          {busy ? "Starting..." : "START SHIFT"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        After you start: the first check-in ping arrives in about 15 seconds,
        then every 15 minutes. You will have 5 minutes to send a live camera
        photo or video each time.
      </p>
    </section>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p className="mt-3 rounded-lg border border-danger bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
      {text}
    </p>
  );
}
