import { APP_TIMEZONE } from "./constants";

/** "8:04:31 PM" in America/Toronto */
export function fmtTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(d));
}

/** "Aug 24, 2026, 8:04:31 PM" in America/Toronto */
export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(d));
}

/** "Aug 24, 2026" in America/Toronto */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(d));
}

/** "m:ss" from a millisecond duration, clamped at 0. */
export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** "h:mm:ss" elapsed duration. */
export function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
