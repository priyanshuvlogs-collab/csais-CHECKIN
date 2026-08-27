import { prisma } from "./prisma";
import { notifyAdmins } from "./notify";
import { haversineMeters } from "./geo";
import { fmtDateTime } from "./time";
import type { Prisma } from "@prisma/client";

/**
 * Anti-cheat engine.
 *
 * Principles:
 *  - The SERVER clock is the only clock that matters. Deadlines, ping times
 *    and response times are always computed server-side, so changing the
 *    phone's clock can never buy a guard extra time.
 *  - Every suspicious signal is recorded as a SecurityFlag row (audit trail),
 *    even when the request itself is rejected, so dispatch can see ATTEMPTS.
 *  - Critical flags additionally alert every admin immediately.
 */

export type RequestContext = {
  ip: string;
  userAgent: string;
  deviceId: string | null;
};

/** Extract ip / user-agent / device id from a request. */
export function getRequestContext(req: Request): RequestContext {
  const fwd = req.headers.get("x-forwarded-for");
  const ip =
    (fwd ? fwd.split(",")[0].trim() : null) ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return {
    ip,
    userAgent: req.headers.get("user-agent") || "unknown",
    deviceId: req.headers.get("x-device-id"),
  };
}

/** Clients report clock drift beyond this as a flag (ms). */
const CLOCK_SKEW_FLAG_MS = 3 * 60 * 1000;
/** Movement faster than this between GPS points is flagged (m/s). ~150 km/h */
const IMPOSSIBLE_SPEED_MPS = 42;

type FlagInput = {
  guardId: string;
  shiftId?: string | null;
  checkinId?: string | null;
  type: string;
  severity: "info" | "warn" | "critical";
  detail: string;
  meta?: Prisma.InputJsonValue;
  /** Also alert all admins right now (defaults to true for critical). */
  notify?: boolean;
};

/** Record a security flag; alerts admins for critical (or when asked). */
export async function raiseFlag(input: FlagInput): Promise<void> {
  const flag = await prisma.securityFlag.create({
    data: {
      guardId: input.guardId,
      shiftId: input.shiftId ?? null,
      checkinId: input.checkinId ?? null,
      type: input.type,
      severity: input.severity,
      detail: input.detail,
      meta: input.meta,
    },
    include: { guard: { select: { name: true, phone: true } } },
  });

  const shouldNotify = input.notify ?? input.severity === "critical";
  if (shouldNotify) {
    await notifyAdmins({
      type: `security_${input.type}`,
      title: `Security: ${TYPE_TITLES[input.type] ?? input.type} — ${flag.guard.name}`,
      body: `${input.detail}\nGuard: ${flag.guard.name} (${flag.guard.phone ?? "no phone"})\nTime: ${fmtDateTime(new Date())}`,
      payload: {
        flagId: flag.id,
        guardId: input.guardId,
        shiftId: input.shiftId ?? null,
        checkinId: input.checkinId ?? null,
        flagType: input.type,
        severity: input.severity,
      },
    });
  }
}

const TYPE_TITLES: Record<string, string> = {
  clock_skew: "Device clock tampering suspected",
  ip_change: "IP address changed mid-shift",
  device_change: "Different device used mid-shift",
  impossible_speed: "Impossible movement speed (GPS spoof?)",
  mock_gps: "Mock GPS provider suspected",
  gps_time_mismatch: "GPS timestamp mismatch",
  gallery_rejected: "Old/gallery media upload attempt",
  file_picker_rejected: "File-picker upload attempt",
  reused_media_rejected: "Reused media file attempt",
  long_video_rejected: "Over-length video attempt",
};

/**
 * Compare a request against the device baseline saved at shift start.
 * Flags IP changes (VPN hopping / relaying the link to someone off-site) and
 * device changes (someone else answering the pings on another phone).
 */
export async function checkShiftDeviceIntegrity(
  shiftId: string,
  guardId: string,
  ctx: RequestContext,
  checkinId?: string | null
): Promise<void> {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    select: { extra: true },
  });
  const baseline = (shift?.extra ?? {}) as Record<string, unknown>;
  const baseIp = typeof baseline.ip === "string" ? baseline.ip : null;
  const baseUa =
    typeof baseline.userAgent === "string" ? baseline.userAgent : null;
  const baseDevice =
    typeof baseline.deviceId === "string" ? baseline.deviceId : null;

  if (baseIp && ctx.ip !== "unknown" && ctx.ip !== baseIp) {
    // Only flag each distinct new IP once per shift to avoid alert storms.
    const already = await prisma.securityFlag.findFirst({
      where: {
        shiftId,
        type: "ip_change",
        meta: { path: ["newIp"], equals: ctx.ip },
      },
    });
    if (!already) {
      await raiseFlag({
        guardId,
        shiftId,
        checkinId,
        type: "ip_change",
        severity: "warn",
        notify: true,
        detail: `Network address changed mid-shift: shift started from ${baseIp}, this request came from ${ctx.ip}. Could be normal (WiFi to cellular) or a VPN / different location.`,
        meta: { baseIp, newIp: ctx.ip },
      });
    }
  }

  const deviceChanged =
    (baseDevice && ctx.deviceId && ctx.deviceId !== baseDevice) ||
    (baseUa && ctx.userAgent !== "unknown" && ctx.userAgent !== baseUa);
  if (deviceChanged) {
    const already = await prisma.securityFlag.findFirst({
      where: {
        shiftId,
        type: "device_change",
        meta: { path: ["newDeviceId"], equals: ctx.deviceId ?? "ua-only" },
      },
    });
    if (!already) {
      await raiseFlag({
        guardId,
        shiftId,
        checkinId,
        type: "device_change",
        severity: "critical",
        detail: `A DIFFERENT device answered mid-shift. The shift was started on one phone but this request came from another browser/device. Someone else may be doing the guard's check-ins.`,
        meta: {
          baseDeviceId: baseDevice,
          newDeviceId: ctx.deviceId ?? "ua-only",
          baseUserAgent: baseUa,
          newUserAgent: ctx.userAgent,
        },
      });
    }
  }
}

/** Flag a device clock that disagrees badly with the server clock. */
export async function checkClockSkew(opts: {
  guardId: string;
  shiftId?: string | null;
  checkinId?: string | null;
  clientTimeMs: number;
  source: string;
}): Promise<number> {
  const skewMs = opts.clientTimeMs - Date.now();
  if (Math.abs(skewMs) > CLOCK_SKEW_FLAG_MS) {
    const already = opts.shiftId
      ? await prisma.securityFlag.findFirst({
          where: { shiftId: opts.shiftId, type: "clock_skew" },
        })
      : null;
    if (!already) {
      await raiseFlag({
        guardId: opts.guardId,
        shiftId: opts.shiftId,
        checkinId: opts.checkinId,
        type: "clock_skew",
        severity: "warn",
        notify: true,
        detail: `Device clock is ${Math.round(Math.abs(skewMs) / 60000)} minute(s) ${skewMs > 0 ? "ahead of" : "behind"} the server (seen on ${opts.source}). Deadlines are enforced by the SERVER clock, so this cannot extend the window — but it can indicate clock tampering.`,
        meta: { skewMs, source: opts.source },
      });
    }
  }
  return skewMs;
}

/**
 * GPS spoof heuristics for a new location point.
 *  - impossible speed vs the previous point (teleporting)
 *  - suspiciously perfect accuracy (mock providers often report 0 or 1 m)
 *  - GPS fix timestamp far from the server receive time
 */
export async function checkGpsIntegrity(opts: {
  guardId: string;
  shiftId: string;
  checkinId?: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  clientAt: Date;
  previous: { lat: number; lng: number; serverAt: Date } | null;
}): Promise<void> {
  const now = Date.now();

  if (opts.previous) {
    const meters = haversineMeters(
      opts.previous.lat,
      opts.previous.lng,
      opts.lat,
      opts.lng
    );
    const seconds = Math.max(
      1,
      (now - opts.previous.serverAt.getTime()) / 1000
    );
    const speed = meters / seconds;
    if (speed > IMPOSSIBLE_SPEED_MPS && meters > 500) {
      await raiseFlag({
        guardId: opts.guardId,
        shiftId: opts.shiftId,
        checkinId: opts.checkinId,
        type: "impossible_speed",
        severity: "critical",
        detail: `GPS jumped ${meters} m in ${Math.round(seconds)} s (${Math.round(speed * 3.6)} km/h). A phone on post cannot move that fast — likely a fake/mock GPS app or a different phone in another location.`,
        meta: { meters, seconds: Math.round(seconds), kmh: Math.round(speed * 3.6) },
      });
    }
  }

  if (opts.accuracy != null && opts.accuracy >= 0 && opts.accuracy < 1) {
    const already = await prisma.securityFlag.findFirst({
      where: { shiftId: opts.shiftId, type: "mock_gps" },
    });
    if (!already) {
      await raiseFlag({
        guardId: opts.guardId,
        shiftId: opts.shiftId,
        checkinId: opts.checkinId,
        type: "mock_gps",
        severity: "warn",
        notify: true,
        detail: `GPS reported an accuracy of ${opts.accuracy} m. Real receivers are rarely below 1 m; mock-location apps often report perfect accuracy.`,
        meta: { accuracy: opts.accuracy },
      });
    }
  }

  const fixAge = now - opts.clientAt.getTime();
  if (Math.abs(fixAge) > CLOCK_SKEW_FLAG_MS) {
    const already = await prisma.securityFlag.findFirst({
      where: { shiftId: opts.shiftId, type: "gps_time_mismatch" },
    });
    if (!already) {
      await raiseFlag({
        guardId: opts.guardId,
        shiftId: opts.shiftId,
        checkinId: opts.checkinId,
        type: "gps_time_mismatch",
        severity: "warn",
        notify: true,
        detail: `The GPS fix claims a time ${Math.round(Math.abs(fixAge) / 60000)} minute(s) ${fixAge > 0 ? "in the future" : "in the past"} versus the server. Possible replayed/canned location or a tampered clock.`,
        meta: { fixAgeMs: fixAge },
      });
    }
  }
}

/** Count flags per shift for the dispatch board badges. */
export async function flagCountsByShift(
  shiftIds: string[]
): Promise<Map<string, number>> {
  if (shiftIds.length === 0) return new Map();
  const rows = await prisma.securityFlag.groupBy({
    by: ["shiftId"],
    where: { shiftId: { in: shiftIds } },
    _count: { _all: true },
  });
  return new Map(
    rows
      .filter((r) => r.shiftId)
      .map((r) => [r.shiftId as string, r._count._all])
  );
}
