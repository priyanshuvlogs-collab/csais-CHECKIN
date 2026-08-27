import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "admin") redirect("/dispatch");
    redirect("/app");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-10">
      <h1 className="text-center text-4xl font-black tracking-tight">CSAIS</h1>
      <p className="mt-2 text-center text-muted">
        Live guard check-in system — choose your panel
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {/* Guard panel */}
        <div className="flex flex-col rounded-2xl border-2 border-accent bg-surface p-6">
          <p className="text-xs font-black uppercase tracking-wide text-accent">
            For guards on post
          </p>
          <h2 className="mt-1 text-2xl font-black">Guard panel</h2>
          <ul className="mt-3 flex-1 space-y-1 text-sm text-muted">
            <li>• Start and end your shift</li>
            <li>• Answer check-in pings with a live camera photo or video</li>
            <li>• Send your GPS location to dispatch</li>
          </ul>
          <Link
            href="/login"
            className="mt-5 rounded-lg bg-accent px-4 py-4 text-center text-lg font-black text-black"
          >
            GUARD LOGIN
          </Link>
          <Link
            href="/register"
            className="mt-2 rounded-lg border border-line px-4 py-3 text-center text-sm font-bold text-muted hover:text-foreground"
          >
            New guard? Register here
          </Link>
        </div>

        {/* Admin panel */}
        <div className="flex flex-col rounded-2xl border-2 border-line bg-surface p-6">
          <p className="text-xs font-black uppercase tracking-wide text-warn">
            For dispatch / supervisors
          </p>
          <h2 className="mt-1 text-2xl font-black">Dispatch admin panel</h2>
          <ul className="mt-3 flex-1 space-y-1 text-sm text-muted">
            <li>• Live duty board with WAITING / MISSED / ON DUTY</li>
            <li>• CALL NOW alerts with name, site and phone</li>
            <li>• 24-hour reports, guards, sites and admin management</li>
          </ul>
          <Link
            href="/admin/login"
            className="mt-5 rounded-lg border-2 border-warn px-4 py-4 text-center text-lg font-black text-warn"
          >
            ADMIN LOGIN
          </Link>
          <p className="mt-2 px-4 py-3 text-center text-xs text-muted">
            Admin accounts are created by an existing admin
          </p>
        </div>
      </div>
    </main>
  );
}
