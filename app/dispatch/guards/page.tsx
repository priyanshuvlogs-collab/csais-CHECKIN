import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

export default async function GuardsPage() {
  const guards = await prisma.user.findMany({
    where: { role: "guard" },
    orderBy: { createdAt: "desc" },
    include: {
      shifts: {
        where: { active: true },
        select: { siteName: true, startedAt: true },
        take: 1,
      },
    },
  });

  return (
    <main>
      <h1 className="text-2xl font-black">Guards ({guards.length})</h1>
      <p className="mt-1 text-sm text-muted">
        Guards must have a full name and phone number before they can start a shift.
      </p>

      {guards.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-muted">
          No guards registered yet. Guards self-register at /register.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Profile</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Registered</th>
              </tr>
            </thead>
            <tbody>
              {guards.map((g) => {
                const complete = g.nameConfirmed && Boolean(g.phone);
                const activeShift = g.shifts[0] ?? null;
                return (
                  <tr key={g.id} className="border-t border-line bg-surface">
                    <td className="px-3 py-2 font-bold">{g.name}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono">
                      {g.phone ?? "—"}
                      {g.phone && <CopyButton text={g.phone} />}
                    </td>
                    <td className="px-3 py-2">
                      {complete ? (
                        <span className="rounded bg-accent/20 px-2 py-0.5 text-xs font-black uppercase text-accent">
                          Complete
                        </span>
                      ) : (
                        <span className="rounded bg-danger/20 px-2 py-0.5 text-xs font-black uppercase text-danger">
                          {!g.phone ? "No phone" : "Name unconfirmed"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {activeShift
                        ? `ON DUTY at ${activeShift.siteName}`
                        : "Off duty"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">
                      {fmtDateTime(g.createdAt)}
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
