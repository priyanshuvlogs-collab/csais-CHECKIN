import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Poll notifications. ?since=ISO returns only newer ones (for toasts). */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });

  return NextResponse.json({
    serverNow: new Date().toISOString(),
    unreadCount,
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      payload: n.payload,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

/** Mark notifications read: { ids: [...] } or { all: true }. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const parsed = z
    .object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() })
    .safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
      ...(parsed.data.all ? {} : { id: { in: parsed.data.ids ?? [] } }),
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
