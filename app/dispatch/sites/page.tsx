import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { AddSiteForm, RemoveSiteButton } from "@/components/dispatch/SiteManager";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });

  return (
    <main>
      <h1 className="text-2xl font-black">Sites ({sites.filter((s) => s.active).length} active)</h1>
      <p className="mt-1 text-sm text-muted">
        Sites are also created automatically when a guard types a new site name at shift start.
      </p>

      <div className="mt-4 rounded-xl border border-line bg-surface p-4">
        <AddSiteForm />
      </div>

      {sites.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-surface p-6 text-center text-muted">
          No sites yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {sites.map((s) => (
            <li
              key={s.id}
              className={`flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 ${
                s.active ? "" : "opacity-50"
              }`}
            >
              <div>
                <p className="font-bold">
                  {s.name}
                  {!s.active && (
                    <span className="ml-2 text-xs font-semibold uppercase text-muted">
                      inactive
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">Added {fmtDateTime(s.createdAt)}</p>
              </div>
              {s.active && <RemoveSiteButton id={s.id} name={s.name} />}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
