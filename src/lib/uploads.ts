import { mkdir, writeFile, stat, access } from "fs/promises";
import { constants } from "fs";
import path from "path";
import os from "os";
import { MAX_FILE_BYTES, ALLOWED_MIME } from "@/lib/constants";

export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
export const FALLBACK_UPLOAD_DIR = path.join(os.tmpdir(), "notebook_uploads");

const EXT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".md": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export type StoredFile = {
  storedName: string;
  originalName: string;
  size: number;
  mime: string;
};

export function mimeFor(name: string) {
  return EXT_MIME[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}

/** Check if an object behaves like an uploaded File/Blob across realms. */
export function isUploadableFile(file: unknown): file is File {
  return Boolean(
    file &&
      typeof file === "object" &&
      "size" in file &&
      typeof (file as { size: unknown }).size === "number" &&
      "arrayBuffer" in file &&
      typeof (file as { arrayBuffer: unknown }).arrayBuffer === "function",
  );
}

export function validateFile(file: File): string | null {
  const fileName = file.name || "document.bin";
  const ext = path.extname(fileName).toLowerCase();
  const allowedExts = Object.values(ALLOWED_MIME)
    .flat()
    .map((e) => e.toLowerCase());

  const mimeMatches = file.type ? ALLOWED_MIME[file.type]?.includes(ext) : false;
  const extMatches = allowedExts.includes(ext);

  if (!extMatches && !mimeMatches) {
    return "Unsupported file type. Please upload a PDF, DOC/DOCX, PPT/PPTX, image, or text file.";
  }
  if (file.size > MAX_FILE_BYTES) return "File is larger than the 5 MB limit.";
  if (file.size === 0) return "That file appears to be empty.";
  return null;
}

async function getWritableDir(): Promise<string> {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await access(UPLOAD_DIR, constants.W_OK);
    return UPLOAD_DIR;
  } catch {
    await mkdir(FALLBACK_UPLOAD_DIR, { recursive: true });
    return FALLBACK_UPLOAD_DIR;
  }
}

export async function saveUpload(file: File, prefix = "res"): Promise<StoredFile> {
  const fileName = file.name || "document.bin";
  const ext = path.extname(fileName).toLowerCase() || ".bin";
  const base = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storedName = `${base}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = mimeFor(storedName);

  // 1. Persist directly to PostgreSQL database so it survives serverless restarts
  try {
    const { pool } = await import("@/db");
    await pool.query(
      `CREATE TABLE IF NOT EXISTS file_storage (
        id VARCHAR(255) PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(128) NOT NULL,
        file_size INTEGER NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`
    );
    await pool.query(
      `INSERT INTO file_storage (id, file_name, mime_type, file_size, data)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, file_name = EXCLUDED.file_name, file_size = EXCLUDED.file_size`,
      [storedName, fileName, mime, file.size, bytes]
    );
  } catch (dbErr) {
    console.warn("[uploads] Database persistence warning:", dbErr);
  }

  // 2. Also write to disk if writable
  try {
    const targetDir = await getWritableDir();
    await writeFile(path.join(targetDir, storedName), bytes);
  } catch (fsErr) {
    console.warn("[uploads] Disk write warning:", fsErr);
  }

  return {
    storedName,
    originalName: fileName.replace(/[^\w.\- ()]/g, "_").slice(0, 180),
    size: file.size,
    mime,
  };
}

export function safeJoin(name: string): string | null {
  const clean = path.basename(name);
  if (!/^[\w.\-]+$/.test(clean)) return null;

  // Check primary upload dir first
  const primary = path.join(UPLOAD_DIR, clean);
  return primary;
}

export async function resolveFilePath(name: string): Promise<string | null> {
  const clean = path.basename(name);
  if (!/^[\w.\-]+$/.test(clean)) return null;

  const primary = path.join(UPLOAD_DIR, clean);
  try {
    await stat(primary);
    return primary;
  } catch {
    // Check fallback temp dir
    const fallback = path.join(FALLBACK_UPLOAD_DIR, clean);
    try {
      await stat(fallback);
      return fallback;
    } catch {
      return null;
    }
  }
}

export async function fileSizeOnDisk(name: string) {
  const p = await resolveFilePath(name);
  if (!p) return null;
  try {
    const s = await stat(p);
    return s.size;
  } catch {
    return null;
  }
}
