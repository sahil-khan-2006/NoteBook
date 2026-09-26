import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { getSessionUser } from "@/lib/auth";
import { resolveFilePath, mimeFor } from "@/lib/uploads";
import { eq, or } from "drizzle-orm";
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
  if (!name) return NextResponse.json({ error: "File name is required" }, { status: 400 });

  try {
    // 1. Check if the post record matches filePath or fileName
    const decoded = decodeURIComponent(name);
    const [row] = await db
      .select({
        id: posts.id,
        fileName: posts.fileName,
        filePath: posts.filePath,
        mimeType: posts.mimeType,
      })
      .from(posts)
      .where(or(eq(posts.filePath, decoded), eq(posts.fileName, decoded)))
      .limit(1);

    const diskFileName = row?.filePath || decoded;
    const downloadName = row?.fileName || diskFileName;

    // 2. Check database file storage first (guarantees survival across serverless instances)
    try {
      const { pool } = await import("@/db");
      const dbRes = await pool.query(
        `SELECT file_name, mime_type, file_size, data FROM file_storage WHERE id = $1 OR id = $2`,
        [diskFileName, row?.filePath || diskFileName]
      );
      if (dbRes.rows.length > 0 && dbRes.rows[0].data) {
        const fileRow = dbRes.rows[0];
        const buf = fileRow.data as Buffer;
        const mime = row?.mimeType || fileRow.mime_type || mimeFor(diskFileName);
        const inline = mime === "application/pdf" || mime.startsWith("image/");
        const finalName = downloadName || fileRow.file_name || diskFileName;

        return new NextResponse(new Uint8Array(buf), {
          headers: {
            "Content-Type": mime,
            "Content-Length": String(buf.length),
            "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${finalName.replace(/"/g, "")}"`,
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    } catch (dbErr) {
      console.warn("[file delivery] DB storage check warning:", dbErr);
    }

    // 3. Resolve actual file path on disk (checks both primary and temp dir)
    let fullPath = await resolveFilePath(diskFileName);
    if (!fullPath && row?.filePath) {
      fullPath = await resolveFilePath(row.filePath);
    }

    if (!fullPath) {
      return NextResponse.json({ error: "File not found on server storage." }, { status: 404 });
    }

    const buf = await readFile(fullPath);
    const mime = row?.mimeType || mimeFor(diskFileName);
    const inline = mime === "application/pdf" || mime.startsWith("image/");

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${downloadName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[file delivery]", err);
    return NextResponse.json({ error: "Could not read file." }, { status: 500 });
  }
}
