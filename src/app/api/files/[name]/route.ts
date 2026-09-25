import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getSessionUser } from "@/lib/auth";
import { safeJoin, mimeFor } from "@/lib/uploads";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";

export const runtime = "nodejs";

/** Authenticated file delivery — files live on disk, never inside DB records. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { name } = await params;
  const path = safeJoin(name);
  if (!path) return NextResponse.json({ error: "Bad file name" }, { status: 400 });
  try {
    const buf = await readFile(path);
    const mime = mimeFor(name);
    const inline = mime === "application/pdf" || mime.startsWith("image/");
    const [row] = await db
      .select({ fileName: posts.fileName })
      .from(posts)
      .where(eq(posts.filePath, name))
      .limit(1);
    const downloadName = row?.fileName ?? name;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${downloadName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
