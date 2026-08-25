import cron from "node-cron";
import { prisma } from "./prisma";
import { sendPing, isPingDue, expireCheckin, endShift } from "./checkin";
import { buildReport, reportToText } from "./report";
import { notifyAdmins } from "./notify";
import { APP_TIMEZONE, MAX_SHIFT_MS, WORKER_SWEEP_MS } from "./constants";

let started = false;

/**
 * In-process background worker. Started once from instrumentation.ts when the
 * Next.js server boots (dev and production). Handles:
 *   - sending due pings (first ~15s after shift start, then every 15 min)
 *   - expiring pending check-ins past their 5-minute deadline
 *   - auto-ending shifts after 12 hours
 *   - the 07:00 America/Toronto daily report
 */
export function startWorker() {
  if (started) return;
  started = true;
  console.log("[worker] CSAIS background worker started");

  setInterval(() => {
    sweep().catch((err) => console.error("[worker] sweep error:", err));
  }, WORKER_SWEEP_MS);

  cron.schedule(
    "0 7 * * *",
    () => {
      dailyReport().catch((err) =>
        console.error("[worker] daily report error:", err)
      );
    },
    { timezone: APP_TIMEZONE }
  );
}

let sweeping = false;

async function sweep() {
  if (sweeping) return; // never overlap sweeps
  sweeping = true;
  try {
    const now = new Date();

    // 1. Auto-end shifts older than 12 hours.
    const overdue = await prisma.shift.findMany({
      where: { active: true, startedAt: { lt: new Date(now.getTime() - MAX_SHIFT_MS) } },
      select: { id: true },
    });
    for (const s of overdue) {
      await endShift(s.id, "auto");
    }

    // 2. Expire pending check-ins past their deadline (fires CALL NOW).
    const expired = await prisma.checkin.findMany({
      where: { status: "pending", deadlineAt: { lt: now } },
      select: { id: true },
    });
    for (const c of expired) {
      await expireCheckin(c.id);
    }

    // 3. Send due pings for active shifts.
    const shifts = await prisma.shift.findMany({
      where: { active: true },
      select: {
        id: true,
        startedAt: true,
        checkins: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { sentAt: true, status: true },
        },
      },
    });
    for (const s of shifts) {
      const last = s.checkins[0] ?? null;
      if (last?.status === "pending") continue;
      if (isPingDue(s.startedAt, last?.sentAt ?? null, now)) {
        await sendPing(s.id);
      }
    }
  } finally {
    sweeping = false;
  }
}

/** Generate and deliver the daily 24h report. Idempotent per Toronto day. */
export async function dailyReport() {
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
  }).format(new Date()); // YYYY-MM-DD in Toronto

  // Meta guard so a server restart never double-sends the same day's report.
  const existing = await prisma.meta.findUnique({
    where: { key: "daily_report_last" },
  });
  if (existing?.value === todayKey) return;
  await prisma.meta.upsert({
    where: { key: "daily_report_last" },
    update: { value: todayKey },
    create: { key: "daily_report_last", value: todayKey },
  });

  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const report = await buildReport(from, to);

  await notifyAdmins({
    type: "daily_report",
    title: `Daily 24h report — ${todayKey}`,
    body: reportToText(report),
    payload: { report: JSON.parse(JSON.stringify(report)) },
  });
  console.log(`[worker] daily report sent for ${todayKey}`);
}
