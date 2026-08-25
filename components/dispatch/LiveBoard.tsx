"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { fmtCountdown, fmtDateTime, fmtTime } from "@/lib/time";

type Gps = { lat: number; lng: number; at: string; mapLink: string; isLive?: boolean } | null;

type WaitingRow = {
  shiftId: string;
  checkinId: string;
  name: string;
  phone: string | null;
  site: string;
  pingedAt: string;
  deadlineAt: string;
  gps: Gps;
};

type MissedRow = {
  checkinId: string;
  name: string;
  phone: string | null;
  site: string;
  shiftActive: boolean;
  pingedAt: string;
  missedAt: string;
  gps: Gps;
};

type OnDutyRow = {
  shiftId: string;
  name: string;
  phone: string | null;
  site: string;
  startedAt: string;
  nextPingAt: string;
  lastCheckinStatus: string | null;
  gps: Gps;
};

type Board = {
  serverNow: string;
  waiting: WaitingRow[];
  missed: MissedRow[];
  onDuty: OnDutyRow[];
};

export function LiveBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [pinging, setPinging] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/dispatch/board", { cache: "no-store" });
      if (!res.ok) return;
      const data: Board = await res.json();
      setClockOffset(new Date(data.serverNow).getTime() - Date.now());
      setBoard(data);
    } catch {
      // retry on next poll
    }
  }, []);

  useEffect(() => {
    poll();
    const p = setInterval(poll, 5000);
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(p);
      clearInterval(t);
    };
  }, [poll]);

  async function pingNow(shiftId: string) {
    setPinging(shiftId);
    await fetch("/api/dispatch/ping-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftId }),
    });
    setPinging(null);
    poll();
  }

  if (!board) {
    return <p className="text-muted">Loading live board...</p>;
  }

  const serverNow = now + clockOffset;

  return (
    <div className="space-y-8">
      {/* MISSED */}
      <section>
        <h2 className="mb-3 text-lg font-black uppercase tracking-wide text-danger">
          Missed — call now ({board.missed.length})
        </h2>
        {board.missed.length === 0 ? (
          <Empty text="No missed check-ins." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {board.missed.map((m) => (
              <div
                key={m.checkinId}
                className="rounded-xl border-2 border-danger bg-[#2a0f0f] p-4"
              >
                <p className="text-lg font-black text-danger">CALL NOW — MISSED UPLOAD</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <BoardRow label="Name" value={m.name} />
                  <BoardRow label="Site" value={m.site} />
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">Phone</dt>
                    <dd className="font-mono text-lg font-black">
                      {m.phone ?? "—"}
                      {m.phone && <CopyButton text={m.phone} />}
                    </dd>
                  </div>
                  <BoardRow label="Pinged at" value={fmtDateTime(m.pingedAt)} />
                  <BoardRow label="Missed at" value={fmtDateTime(m.missedAt)} />
                  <BoardRow
                    label="Last GPS"
                    value={m.gps ? `${m.gps.lat.toFixed(5)},${m.gps.lng.toFixed(5)} at ${fmtTime(m.gps.at)}` : "none this shift"}
                  />
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.gps && (
                    <a
                      href={m.gps.mapLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-bold"
                    >
                      Open map
                    </a>
                  )}
                  <Link
                    href={`/dispatch/checkins/${m.checkinId}`}
                    className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-bold"
                  >
                    Details
                  </Link>
                  {!m.shiftActive && (
                    <span className="px-2 py-1.5 text-xs text-muted">shift ended</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* WAITING */}
      <section>
        <h2 className="mb-3 text-lg font-black uppercase tracking-wide text-warn">
          Waiting for photo ({board.waiting.length})
        </h2>
        {board.waiting.length === 0 ? (
          <Empty text="Nobody is waiting on a check-in right now." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {board.waiting.map((w) => {
              const left = new Date(w.deadlineAt).getTime() - serverNow;
              return (
                <div key={w.checkinId} className="rounded-xl border-2 border-warn bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-black">{w.name}</p>
                    <span className={`font-mono text-2xl font-black ${left < 60000 ? "text-danger" : "text-warn"}`}>
                      {fmtCountdown(left)}
                    </span>
                  </div>
                  <dl className="mt-2 space-y-1 text-sm">
                    <BoardRow label="Site" value={w.site} />
                    <div className="flex items-center justify-between">
                      <dt className="text-muted">Phone</dt>
                      <dd className="font-mono font-bold">
                        {w.phone ?? "—"}
                        {w.phone && <CopyButton text={w.phone} />}
                      </dd>
                    </div>
                    <BoardRow label="Pinged at" value={fmtTime(w.pingedAt)} />
                  </dl>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ON DUTY */}
      <section>
        <h2 className="mb-3 text-lg font-black uppercase tracking-wide text-accent">
          On duty — OK ({board.onDuty.length})
        </h2>
        {board.onDuty.length === 0 && board.waiting.length === 0 ? (
          <Empty text="No one on duty." />
        ) : board.onDuty.length === 0 ? (
          <Empty text="Everyone on duty is currently in a check-in window." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {board.onDuty.map((g) => (
              <div key={g.shiftId} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="font-black">{g.name}</p>
                  <span className="font-mono text-lg font-bold text-accent">
                    {fmtCountdown(new Date(g.nextPingAt).getTime() - serverNow)}
                  </span>
                </div>
                <dl className="mt-2 space-y-1 text-sm">
                  <BoardRow label="Site" value={g.site} />
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">Phone</dt>
                    <dd className="font-mono font-bold">
                      {g.phone ?? "—"}
                      {g.phone && <CopyButton text={g.phone} />}
                    </dd>
                  </div>
                  <BoardRow label="On duty since" value={fmtTime(g.startedAt)} />
                  <BoardRow
                    label="Last GPS"
                    value={g.gps ? `${fmtTime(g.gps.at)}${g.gps.isLive ? " (live)" : ""}` : "none"}
                  />
                </dl>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => pingNow(g.shiftId)}
                    disabled={pinging === g.shiftId}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-black text-black disabled:opacity-50"
                  >
                    {pinging === g.shiftId ? "Pinging..." : "Ping now"}
                  </button>
                  {g.gps && (
                    <a
                      href={g.gps.mapLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-bold"
                    >
                      Map
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-line bg-surface p-6 text-center text-muted">
      {text}
    </p>
  );
}

function BoardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
