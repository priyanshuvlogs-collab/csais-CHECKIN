import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export type AdminEvent = {
  /** Machine type, e.g. "checkin_missed", "gps_first", "daily_report". */
  type: string;
  /** Short headline, e.g. "CALL NOW — MISSED UPLOAD". */
  title: string;
  /** Plain-text body shown in-app and sent by email. */
  body: string;
  /** Structured data for the UI (phone, checkinId, gps, ...). */
  payload?: Prisma.InputJsonValue;
};

/**
 * Notify every admin about an event.
 *
 * Channels today: in-app Notification rows (drives the live board toasts and
 * browser Web Notifications) and optional SMTP email. To add Telegram or SMS
 * later, add another sender inside this function — callers never change.
 */
export async function notifyAdmins(event: AdminEvent): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: "admin", approved: true },
    select: { id: true, email: true },
  });
  if (admins.length === 0) return;

  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: event.type,
      title: event.title,
      body: event.body,
      payload: event.payload,
    })),
  });

  // Optional email channel. Failures are logged, never thrown — the in-app
  // notification is already saved and dispatch must keep working.
  if (process.env.SMTP_HOST) {
    const to = admins.map((a) => a.email).filter(Boolean) as string[];
    if (to.length > 0) {
      try {
        await sendEmail(to, event.title, event.body);
      } catch (err) {
        console.error("[notify] email send failed:", err);
      }
    }
  }
}

async function sendEmail(to: string[], subject: string, text: string) {
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || "CSAIS Dispatch <dispatch@csais.local>",
    to: to.join(", "),
    subject: `[CSAIS] ${subject}`,
    text,
  });
}
