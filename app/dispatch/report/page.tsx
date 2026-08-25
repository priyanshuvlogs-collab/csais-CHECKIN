import Link from "next/link";
import { buildReport } from "@/lib/report";
import { fmtDateTime, fmtTime } from "@/lib/time";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ hours?: string }>;
}) {
  const params = await searchParams;
  const hours = Math.min(Math.max(Number(params.hours) || 24, 1), 168);
  const to = new Date();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  const report = await buildReport(from, to);

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Check-in report</h1>
          <p className="mt-1 text-sm text-muted">
            {fmtDateTime(report.from)} — {fmtDateTime(report.to)} (America/Toronto).
            The same report is auto-delivered to all admins at 7:00 AM daily.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dispatch/report?hours=24"
            className="rounded-lg bg-accent px-4 py-2 font-bold text-black"
          >
            Last 24 hours
          </Link>
          <Link
            href="/dispatch/report?hours=168"
            className="rounded-lg border border-line bg-surface px-4 py-2 font-bold"
          >
            Last 7 days
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Shifts" value={report.totals.shifts} />
        <Stat label="OK" value={report.totals.ok} tone="ok" />
        <Stat label="Late" value={report.totals.late} tone="warn" />
        <Stat label="Missed" value={report.totals.missed} tone="danger" />
      </div>

      {report.rows.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-muted">
          No shifts in this window.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Guard</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Site</th>
                <th className="px-3 py-2">Shift start</th>
                <th className="px-3 py-2">Shift end</th>
                <th className="px-3 py-2 text-center">OK</th>
                <th className="px-3 py-2 text-center">Late</th>
                <th className="px-3 py-2 text-center">Missed</th>
                <th className="px-3 py-2">Missed times</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.shiftId} className="border-t border-line bg-surface">
                  <td className="px-3 py-2 font-bold">{r.guardName}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">
                    {r.phone ?? "—"}
                    {r.phone && <CopyButton text={r.phone} />}
                  </td>
                  <td className="px-3 py-2">{r.site}</td>
                  <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(r.shiftStart)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {r.shiftEnd ? fmtDateTime(r.shiftEnd) : r.active ? "ON DUTY" : "—"}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-accent">{r.ok}</td>
                  <td className="px-3 py-2 text-center font-bold text-warn">{r.late}</td>
                  <td className="px-3 py-2 text-center font-bold text-danger">{r.missed}</td>
                  <td className="px-3 py-2 text-danger">
                    {r.missedTimes.length > 0
                      ? r.missedTimes.map((t) => fmtTime(t)).join(", ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "danger";
}) {
  const color =
    tone === "ok"
      ? "text-accent"
      : tone === "warn"
        ? "text-warn"
        : tone === "danger"
          ? "text-danger"
          : "";
  return (
    <div className="rounded-xl border border-line bg-surface p-4 text-center">
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      <p className="text-xs uppercase text-muted">{label}</p>
    </div>
  );
}
