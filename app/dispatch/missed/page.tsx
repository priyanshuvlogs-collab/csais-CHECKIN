import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { CopyButton } from "@/components/CopyButton";
import { mapsLink } from "@/lib/geo";

export const dynamic = "force-dynamic";

export default async function MissedPage() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const missed = await prisma.checkin.findMany({
    where: { status: { in: ["missed", "late"] }, sentAt: { gte: weekAgo } },
    include: {
      guard: { select: { name: true, phone: true } },
      shift: {
        include: { locations: { orderBy: { serverAt: "desc" }, take: 1 } },
      },
    },
    orderBy: { sentAt: "desc" },
    take: 200,
  });

  return (
    <main>
      <h1 className="text-2xl font-black">Missed and late check-ins</h1>
      <p className="mt-1 text-sm text-muted">Last 7 days, newest first.</p>

      {missed.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-muted">
          No missed check-ins.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Guard</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Site</th>
                <th className="px-3 py-2">Pinged at</th>
                <th className="px-3 py-2">Deadline / missed at</th>
                <th className="px-3 py-2">Last GPS</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {missed.map((c) => {
                const loc = c.shift.locations[0] ?? null;
                return (
                  <tr key={c.id} className="border-t border-line bg-surface">
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-black uppercase ${
                          c.status === "missed"
                            ? "bg-danger/20 text-danger"
                            : "bg-warn/20 text-warn"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-bold">{c.guard.name}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono">
                      {c.guard.phone ?? "—"}
                      {c.guard.phone && <CopyButton text={c.guard.phone} />}
                    </td>
                    <td className="px-3 py-2">{c.shift.siteName}</td>
                    <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(c.sentAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(c.deadlineAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {loc ? (
                        <a
                          className="text-accent underline"
                          href={mapsLink(loc.lat, loc.lng)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {loc.lat.toFixed(4)},{loc.lng.toFixed(4)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/dispatch/checkins/${c.id}`} className="text-accent underline">
                        Details
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
