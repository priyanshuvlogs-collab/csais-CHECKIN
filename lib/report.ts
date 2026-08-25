import { prisma } from "./prisma";
import { fmtDateTime, fmtTime } from "./time";

export type ReportRow = {
  guardId: string;
  guardName: string;
  phone: string | null;
  site: string;
  shiftId: string;
  shiftStart: string;
  shiftEnd: string | null;
  active: boolean;
  ok: number;
  late: number;
  missed: number;
  pending: number;
  missedTimes: string[];
};

export type Report = {
  from: string;
  to: string;
  rows: ReportRow[];
  totals: { shifts: number; ok: number; late: number; missed: number };
};

/** Build the check-in report for shifts overlapping [from, to). */
export async function buildReport(from: Date, to: Date): Promise<Report> {
  const shifts = await prisma.shift.findMany({
    where: {
      OR: [
        { startedAt: { gte: from, lt: to } },
        { endedAt: { gte: from, lt: to } },
        { active: true, startedAt: { lt: to } },
      ],
    },
    include: {
      guard: { select: { id: true, name: true, phone: true } },
      checkins: {
        where: { sentAt: { gte: from, lt: to } },
        orderBy: { sentAt: "asc" },
      },
    },
    orderBy: { startedAt: "asc" },
  });

  const rows: ReportRow[] = shifts.map((s) => {
    const ok = s.checkins.filter((c) => c.status === "ok").length;
    const late = s.checkins.filter((c) => c.status === "late").length;
    const missed = s.checkins.filter((c) => c.status === "missed");
    const pending = s.checkins.filter((c) => c.status === "pending").length;
    return {
      guardId: s.guard.id,
      guardName: s.guard.name,
      phone: s.guard.phone,
      site: s.siteName,
      shiftId: s.id,
      shiftStart: s.startedAt.toISOString(),
      shiftEnd: s.endedAt ? s.endedAt.toISOString() : null,
      active: s.active,
      ok,
      late,
      missed: missed.length,
      pending,
      missedTimes: missed.map((c) => c.deadlineAt.toISOString()),
    };
  });

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    rows,
    totals: {
      shifts: rows.length,
      ok: rows.reduce((a, r) => a + r.ok, 0),
      late: rows.reduce((a, r) => a + r.late, 0),
      missed: rows.reduce((a, r) => a + r.missed, 0),
    },
  };
}

/** Plain-text rendering used for the in-app daily report and email. */
export function reportToText(report: Report): string {
  const lines: string[] = [
    `CSAIS check-in report`,
    `Window: ${fmtDateTime(report.from)} to ${fmtDateTime(report.to)} (America/Toronto)`,
    `Shifts: ${report.totals.shifts} | OK: ${report.totals.ok} | Late: ${report.totals.late} | Missed: ${report.totals.missed}`,
    ``,
  ];
  if (report.rows.length === 0) {
    lines.push("No shifts in this window.");
  }
  for (const r of report.rows) {
    lines.push(
      `${r.guardName} (${r.phone ?? "no phone"}) — ${r.site}`,
      `  Shift: ${fmtDateTime(r.shiftStart)} to ${r.shiftEnd ? fmtDateTime(r.shiftEnd) : r.active ? "still on duty" : "—"}`,
      `  OK: ${r.ok} | Late: ${r.late} | Missed: ${r.missed}` +
        (r.missedTimes.length > 0
          ? ` | Missed at: ${r.missedTimes.map((t) => fmtTime(t)).join(", ")}`
          : ""),
      ``
    );
  }
  return lines.join("\n");
}
