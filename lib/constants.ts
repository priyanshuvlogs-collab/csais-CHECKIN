export const APP_TIMEZONE = process.env.APP_TIMEZONE || "America/Toronto";

/** Delay before the first ping after a shift starts. */
export const FIRST_PING_DELAY_MS = 15 * 1000;

/** Interval between pings while on duty. */
export const PING_INTERVAL_MS = 15 * 60 * 1000;

/** Time the guard has to respond to a ping. */
export const CHECKIN_WINDOW_MS = 5 * 60 * 1000;

/** Shifts auto-end after this long. */
export const MAX_SHIFT_MS = 12 * 60 * 60 * 1000;

/** Max allowed video length in seconds. */
export const MAX_VIDEO_SECONDS = 45;

/** Max upload size in bytes (covers a 45s phone video). */
export const MAX_UPLOAD_BYTES = 120 * 1024 * 1024;

/** Notify admins when a guard moves at least this far (meters). */
export const MOVE_NOTIFY_METERS = 50;

/** Worker sweep interval. */
export const WORKER_SWEEP_MS = 5 * 1000;
