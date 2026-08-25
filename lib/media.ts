import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import exifr from "exifr";
import { MAX_UPLOAD_BYTES, MAX_VIDEO_SECONDS } from "./constants";

export type MediaVerdict = {
  ok: boolean;
  /** live | gallery | unverified — only meaningful when ok. */
  source: "live" | "gallery" | "unverified";
  reason?: string;
  takenAt?: Date | null;
};

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "video/webm",
  "video/mp4",
  "video/quicktime",
  "video/3gpp",
];

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Decide whether an upload counts as a live check-in.
 *
 * Rules:
 *  - only camera captures are allowed; the client sends how the media was
 *    produced (getUserMedia recording vs <input capture>) plus timestamps
 *  - a plain file-picker upload is rejected outright
 *  - files whose EXIF capture time or lastModified predate the ping are
 *    treated as gallery/old files and rejected
 *  - getUserMedia blobs are created in-page during the ping → live
 *  - <input capture> photos without EXIF → accepted but UNVERIFIED
 */
export async function verdictForUpload(opts: {
  buffer: Buffer;
  mime: string;
  captureMethod: string; // "getUserMedia" | "capture-input"
  isVideo: boolean;
  durationSeconds: number | null;
  clientLastModified: number | null; // File.lastModified ms epoch
  pingSentAt: Date;
}): Promise<MediaVerdict> {
  const {
    buffer,
    mime,
    captureMethod,
    isVideo,
    durationSeconds,
    clientLastModified,
    pingSentAt,
  } = opts;

  if (buffer.length === 0) {
    return { ok: false, source: "gallery", reason: "Empty file." };
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, source: "gallery", reason: "File too large." };
  }
  if (!ALLOWED_MIME.some((m) => mime.startsWith(m))) {
    return {
      ok: false,
      source: "gallery",
      reason: `Unsupported file type: ${mime}. Use the camera.`,
    };
  }
  if (captureMethod !== "getUserMedia" && captureMethod !== "capture-input") {
    return {
      ok: false,
      source: "gallery",
      reason: "Gallery and file uploads are not accepted. Use the live camera.",
    };
  }
  if (isVideo && durationSeconds != null && durationSeconds > MAX_VIDEO_SECONDS) {
    return {
      ok: false,
      source: "gallery",
      reason: `Video is longer than ${MAX_VIDEO_SECONDS} seconds. Record a shorter one.`,
    };
  }

  // Tolerance for slightly-off phone clocks.
  const CLOCK_SKEW_MS = 90 * 1000;

  // A file that existed before this ping was sent is an old/gallery file.
  if (
    clientLastModified != null &&
    clientLastModified > 0 &&
    clientLastModified < pingSentAt.getTime() - CLOCK_SKEW_MS
  ) {
    return {
      ok: false,
      source: "gallery",
      reason:
        "This file was created before the check-in ping. Old or gallery files are rejected — take a new photo now.",
    };
  }

  // EXIF check for still photos.
  let takenAt: Date | null = null;
  if (!isVideo) {
    try {
      const exif = await exifr.parse(buffer, {
        pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"],
      });
      takenAt =
        exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate ?? null;
      if (takenAt instanceof Date && !isNaN(takenAt.getTime())) {
        if (takenAt.getTime() < pingSentAt.getTime() - CLOCK_SKEW_MS) {
          return {
            ok: false,
            source: "gallery",
            reason:
              "The photo's capture time is before this check-in ping. Gallery or old photos are rejected — take a new photo now.",
            takenAt,
          };
        }
        // EXIF confirms capture during the ping window.
        return { ok: true, source: "live", takenAt };
      }
    } catch {
      takenAt = null; // unreadable EXIF is common; fall through
    }
  }

  if (captureMethod === "getUserMedia") {
    // Created in-page by the camera stream during this ping.
    return { ok: true, source: "live", takenAt };
  }

  // <input capture> media with no EXIF: accept but flag for dispatch.
  return { ok: true, source: "unverified", takenAt };
}

/** Persist the media file to disk; returns the relative storage path. */
export async function storeMedia(
  buffer: Buffer,
  hash: string,
  mime: string
): Promise<string> {
  const ext = extForMime(mime);
  const day = new Date().toISOString().slice(0, 10);
  const rel = path.join(day, `${hash}${ext}`);
  const abs = path.join(uploadDir(), rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
  return rel;
}

function extForMime(mime: string): string {
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp") && mime.startsWith("image")) return ".webp";
  if (mime.includes("heic") || mime.includes("heif")) return ".heic";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("mp4")) return ".mp4";
  if (mime.includes("quicktime")) return ".mov";
  if (mime.includes("3gpp")) return ".3gp";
  return ".bin";
}
