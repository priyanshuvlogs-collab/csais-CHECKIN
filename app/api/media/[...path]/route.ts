import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { uploadDir } from "@/lib/media";

export const dynamic = "force-dynamic";

/** Serves stored check-in media. Admins see everything; guards only their own. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  // Prevent path traversal outside the upload directory.
  const abs = path.resolve(uploadDir(), rel);
  if (!abs.startsWith(uploadDir() + path.sep)) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const checkin = await prisma.checkin.findFirst({
    where: { mediaPath: rel.split("/").join(path.sep) },
  });
  const checkinAlt = checkin ?? (await prisma.checkin.findFirst({ where: { mediaPath: rel } }));
  if (!checkinAlt) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (user.role !== "admin" && checkinAlt.guardId !== user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const data = await readFile(abs);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": checkinAlt.mediaType || "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing on disk." }, { status: 404 });
  }
}
