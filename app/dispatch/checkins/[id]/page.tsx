import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";
import { mapsLink } from "@/lib/geo";
import { CopyButton } from "@/components/CopyButton";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, { text: string; cls: string }> = {
  live: { text: "LIVE CAPTURE", cls: "bg-accent/20 text-accent" },
  unverified: { text: "UNVERIFIED STILL — prefer live video", cls: "bg-warn/20 text-warn" },
  gallery: { text: "GALLERY (rejected)", cls: "bg-danger/20 text-danger" },
};

export default async function CheckinDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const checkin = await prisma.checkin.findUnique({
    where: { id },
    include: {
      guard: { select: { name: true, phone: true } },
      shift: true,
      locations: { orderBy: { serverAt: "desc" } },
    },
  });
  if (!checkin) notFound();

  const flags = await prisma.securityFlag.findMany({
    where: { OR: [{ checkinId: id }, { shiftId: checkin.shiftId }] },
    orderBy: { createdAt: "desc" },
  });

  const mediaUrl = checkin.mediaPath
    ? `/api/media/${checkin.mediaPath.split("\\").join("/")}`
    : null;
  const isVideo = checkin.mediaType?.startsWith("video/");
  const source = checkin.source ? SOURCE_LABEL[checkin.source] : null;
  const extra = (checkin.extra ?? {}) as Record<string, unknown>;

  return (
    <main className="grid gap-6 lg:grid-cols-2">
      <section>
        <h1 className="text-2xl font-black">
          Check-in — {checkin.guard.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          <Link href="/dispatch" className="underline">Back to live board</Link>
        </p>

        <dl className="mt-4 space-y-2 rounded-xl border border-line bg-surface p-4 text-sm">
          <Row label="Status">
            <span
              className={`rounded px-2 py-0.5 text-xs font-black uppercase ${
                checkin.status === "ok"
                  ? "bg-accent/20 text-accent"
                  : checkin.status === "missed"
                    ? "bg-danger/20 text-danger"
                    : checkin.status === "late"
                      ? "bg-warn/20 text-warn"
                      : "bg-surface-2 text-muted"
              }`}
            >
              {checkin.status}
            </span>
          </Row>
          <Row label="Guard">{checkin.guard.name}</Row>
          <Row label="Phone">
            <span className="font-mono font-bold">
              {checkin.guard.phone ?? "—"}
              {checkin.guard.phone && <CopyButton text={checkin.guard.phone} />}
            </span>
          </Row>
          <Row label="Site">{checkin.shift.siteName}</Row>
          <Row label="Shift started">{fmtDateTime(checkin.shift.startedAt)}</Row>
          <Row label="Ping sent at">{fmtDateTime(checkin.sentAt)}</Row>
          <Row label="Deadline">{fmtDateTime(checkin.deadlineAt)}</Row>
          <Row label="Responded at">
            {checkin.respondedAt
              ? `${fmtDateTime(checkin.respondedAt)} (${checkin.responseSeconds}s after ping)`
              : "never"}
          </Row>
          <Row label="Server recorded at">{fmtDateTime(checkin.createdAt)}</Row>
          {typeof extra.takenAt === "string" && (
            <Row label="EXIF taken at">{fmtDateTime(extra.takenAt)}</Row>
          )}
          {typeof extra.captureMethod === "string" && (
            <Row label="Capture method">
              {extra.captureMethod === "getUserMedia"
                ? "In-page camera stream"
                : "Phone camera app"}
            </Row>
          )}
          {checkin.mediaHash && (
            <Row label="File hash">
              <span className="break-all font-mono text-xs">{checkin.mediaHash}</span>
            </Row>
          )}
          {typeof extra.ip === "string" && <Row label="Upload IP">{extra.ip}</Row>}
        </dl>

        <h2 className="mt-6 text-lg font-black">
          Security flags for this shift ({flags.length})
        </h2>
        {flags.length === 0 ? (
          <p className="mt-2 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
            No anti-cheat flags. All clear.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {flags.map((f) => (
              <li
                key={f.id}
                className={`rounded-xl border bg-surface p-3 text-sm ${
                  f.severity === "critical" ? "border-danger" : "border-warn/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-black uppercase ${
                      f.severity === "critical"
                        ? "bg-danger/20 text-danger"
                        : "bg-warn/20 text-warn"
                    }`}
                  >
                    {f.severity} · {f.type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-muted">{fmtDateTime(f.createdAt)}</span>
                </div>
                <p className="mt-1">{f.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-black">Media</h2>
        {source && (
          <p className={`mt-2 inline-block rounded px-2 py-1 text-xs font-black ${source.cls}`}>
            {source.text}
          </p>
        )}
        {mediaUrl ? (
          <div className="mt-3">
            {isVideo ? (
              <video src={mediaUrl} controls playsInline className="w-full rounded-xl border border-line" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt={`Check-in media from ${checkin.guard.name}`} className="w-full rounded-xl border border-line" />
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-line bg-surface p-6 text-center text-muted">
            No media — this check-in was {checkin.status}.
          </p>
        )}

        <h2 className="mt-6 text-lg font-black">GPS points for this check-in</h2>
        {checkin.locations.length === 0 ? (
          <p className="mt-2 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
            No GPS attached to this check-in.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {checkin.locations.map((l) => (
              <li key={l.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                <a
                  href={mapsLink(l.lat, l.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono font-bold text-accent underline"
                >
                  {l.lat.toFixed(6)},{l.lng.toFixed(6)}
                </a>
                <p className="mt-1 text-muted">
                  {l.isLive ? "Live watch" : "One-time pin"} · accuracy{" "}
                  {l.accuracy != null ? `${Math.round(l.accuracy)} m` : "unknown"}
                </p>
                <p className="text-muted">
                  Client: {fmtDateTime(l.clientAt)} · Server: {fmtDateTime(l.serverAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  );
}
