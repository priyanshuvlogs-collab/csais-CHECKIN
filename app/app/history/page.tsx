import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtTime } from "@/lib/time";
import { APP_TIMEZONE } from "@/lib/constants";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  ok: "bg-accent/15 text-accent border-accent",
  late: "bg-warn/15 text-warn border-warn",
  missed: "bg-danger/15 text-danger border-danger",
  pending: "bg-surface-2 text-muted border-line",
  cancelled: "bg-surface-2 text-muted border-line",
};

export default async function HistoryPage() {
  const session = await auth();
  const user = session!.user;

  // Start of today in Toronto, expressed in UTC.
  const nowToronto = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
  }).format(new Date());
  const startOfDayUtc = torontoMidnightUtc(nowToronto);

  const checkins = await prisma.checkin.findMany({
    where: { guardId: user.id, sentAt: { gte: startOfDayUtc } },
    include: { shift: { select: { siteName: true } } },
    orderBy: { sentAt: "desc" },
  });

  return (
    <main>
      <h1 className="text-2xl font-black">My check-ins today</h1>
      <p className="mt-1 text-sm text-muted">Times shown in Toronto time.</p>

      {checkins.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-muted">
          No check-ins yet today.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {checkins.map((c) => (
            <li key={c.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between">
                <span
                  className={`rounded border px-2 py-0.5 text-xs font-black uppercase ${STATUS_STYLES[c.status]}`}
                >
                  {c.status}
                </span>
                <span className="text-sm text-muted">{c.shift.siteName}</span>
              </div>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Pinged at</dt>
                  <dd className="font-semibold">{fmtTime(c.sentAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Deadline</dt>
                  <dd className="font-semibold">{fmtTime(c.deadlineAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Responded</dt>
                  <dd className="font-semibold">
                    {c.respondedAt ? `${fmtTime(c.respondedAt)} (${c.responseSeconds}s)` : "—"}
                  </dd>
                </div>
                {c.source && (
                  <div className="flex justify-between">
                    <dt className="text-muted">Media</dt>
                    <dd className="font-semibold uppercase">{c.source}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center">
        <Link href="/app" className="text-muted underline">
          Back to my shift
        </Link>
      </p>
    </main>
  );
}

/** UTC instant of today's midnight in Toronto given "YYYY-MM-DD". */
function torontoMidnightUtc(ymd: string): Date {
  // Try both possible UTC offsets (EST -5 / EDT -4) and pick the one that
  // formats back to midnight in Toronto.
  for (const offset of [4, 5]) {
    const candidate = new Date(`${ymd}T00:00:00-0${offset}:00`);
    const check = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIMEZONE,
      hour: "2-digit",
      hour12: false,
    }).format(candidate);
    if (check === "00" || check === "24") return candidate;
  }
  return new Date(`${ymd}T00:00:00-05:00`);
}
