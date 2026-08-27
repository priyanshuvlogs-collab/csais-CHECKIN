import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-danger/20 text-danger border-danger",
  warn: "bg-warn/20 text-warn border-warn",
  info: "bg-surface-2 text-muted border-line",
};

const TYPE_LABELS: Record<string, string> = {
  clock_skew: "Clock tampering",
  ip_change: "IP changed mid-shift",
  device_change: "Device changed mid-shift",
  impossible_speed: "Impossible GPS speed",
  mock_gps: "Mock GPS suspected",
  gps_time_mismatch: "GPS time mismatch",
  gallery_rejected: "Gallery upload attempt",
  file_picker_rejected: "File-picker attempt",
  reused_media_rejected: "Reused media attempt",
  long_video_rejected: "Over-length video",
};

export default async function SecurityPage() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const flags = await prisma.securityFlag.findMany({
    where: { createdAt: { gte: weekAgo } },
    include: {
      guard: { select: { name: true, phone: true } },
      shift: { select: { siteName: true, active: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const critical = flags.filter((f) => f.severity === "critical").length;
  const warns = flags.filter((f) => f.severity === "warn").length;

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Security flags</h1>
          <p className="mt-1 text-sm text-muted">
            Anti-cheat signals from the last 7 days: clock tampering, IP/device
            switching, GPS spoofing, and rejected upload attempts.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-lg border border-danger bg-danger/10 px-3 py-1.5 font-bold text-danger">
            {critical} critical
          </span>
          <span className="rounded-lg border border-warn bg-warn/10 px-3 py-1.5 font-bold text-warn">
            {warns} warnings
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
        <p className="font-bold text-foreground">How cheating is blocked</p>
        <p className="mt-1">
          Deadlines and timestamps always use the <strong>server clock</strong> —
          changing the phone&apos;s time cannot extend a check-in window. Gallery
          files, reused files and over-length videos are <strong>rejected before
          they count</strong>; the attempt is logged below. Each shift is bound to
          the device and network it started on, and GPS points are checked for
          impossible jumps and mock-provider signatures.
        </p>
      </div>

      {flags.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-muted">
          No security flags. All clear.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {flags.map((f) => (
            <li
              key={f.id}
              className={`rounded-xl border bg-surface p-4 ${
                f.severity === "critical" ? "border-danger" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-black uppercase ${SEVERITY_STYLES[f.severity]}`}
                >
                  {f.severity}
                </span>
                <span className="font-black">{TYPE_LABELS[f.type] ?? f.type}</span>
                <span className="text-sm text-muted">
                  {f.guard.name} ({f.guard.phone ?? "no phone"})
                  {f.shift ? ` — ${f.shift.siteName}` : ""}
                </span>
                <span className="ml-auto text-xs text-muted">
                  {fmtDateTime(f.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm">{f.detail}</p>
              {f.checkinId && (
                <p className="mt-2 text-sm">
                  <Link
                    href={`/dispatch/checkins/${f.checkinId}`}
                    className="font-bold text-accent underline"
                  >
                    View the check-in
                  </Link>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
