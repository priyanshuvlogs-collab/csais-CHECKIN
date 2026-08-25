import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { AddAdminForm, RemoveAdminButton } from "@/components/dispatch/AdminManager";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const session = await auth();
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main>
      <h1 className="text-2xl font-black">Admins ({admins.length})</h1>
      <p className="mt-1 text-sm text-muted">
        Every admin receives every notification: missed check-ins, GPS alerts and the daily report.
      </p>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-bold">Add an admin</h2>
        <AddAdminForm />
      </div>

      <ul className="mt-4 space-y-2">
        {admins.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3"
          >
            <div>
              <p className="font-bold">
                {a.name}
                {a.id === session?.user.id && (
                  <span className="ml-2 text-xs font-semibold uppercase text-accent">you</span>
                )}
              </p>
              <p className="text-xs text-muted">
                {a.email ?? "no email"} · {a.phone ?? "no phone"} · since {fmtDateTime(a.createdAt)}
              </p>
            </div>
            {a.id !== session?.user.id && <RemoveAdminButton id={a.id} name={a.name} />}
          </li>
        ))}
      </ul>
    </main>
  );
}
