"use client";

/**
 * Stable per-browser device id used by the anti-cheat checks: if a shift is
 * started on one phone and check-ins arrive from another, dispatch is alerted.
 */
export function getDeviceId(): string {
  try {
    const KEY = "csais-device-id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "unavailable";
  }
}

/** Standard headers guards attach to sensitive requests. */
export function deviceHeaders(): Record<string, string> {
  return { "x-device-id": getDeviceId() };
}
