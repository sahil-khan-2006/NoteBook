import { mkdir, writeFile, stat } from "fs/promises";
import path from "path";
import { MAX_FILE_BYTES, ALLOWED_MIME } from "@/lib/constants";

export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

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

export function validateFile(file: File): string | null {
  const ext = path.extname(file.name).toLowerCase();
  const allowedExts = Object.values(ALLOWED_MIME).flat();
  const mimeOk = ALLOWED_MIME[file.type]?.includes(ext) || allowedExts.includes(ext);
  if (!mimeOk)
    return "Unsupported file type. Upload PDF, DOC/DOCX, PPT/PPTX, images or text files.";
  if (file.size > MAX_FILE_BYTES) return "File is larger than the 20 MB limit.";
  if (file.size === 0) return "That file appears to be empty.";
  return null;
}

export async function saveUpload(file: File, prefix = "res"): Promise<StoredFile> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name).toLowerCase() || ".bin";
  const base = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storedName = `${base}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), bytes);
  return {
    storedName,
    originalName: file.name.replace(/[^\w.\- ()]/g, "_").slice(0, 180),
    size: file.size,
    mime: mimeFor(storedName),
  };
}

export function safeJoin(name: string) {
  const clean = path.basename(name);
  if (!/^[\w.\-]+$/.test(clean)) return null;
  return path.join(UPLOAD_DIR, clean);
}

export async function fileSizeOnDisk(name: string) {
  const p = safeJoin(name);
  if (!p) return null;
  try {
    const s = await stat(p);
    return s.size;
  } catch {
    return null;
  }
}
