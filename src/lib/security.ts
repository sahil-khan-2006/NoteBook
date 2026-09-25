import { scrypt, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const PEPPER = process.env.AUTH_PEPPER || "bpmandal-hub-pepper-v1";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "bpmandal-hub-session-secret-change-in-prod";

/* ------------------------------- passwords -------------------------------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password + PEPPER, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const [scheme, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const derived = await scryptAsync(password + PEPPER, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (expected.length !== derived.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* -------------------------------- sessions -------------------------------- */

export type SessionPayload = {
  uid: string;
  exp: number;
  remember?: boolean;
};

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token?: string | null): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as SessionPayload;
    if (!payload.uid || typeof payload.exp !== "number") return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ------------------------------- rate limit ------------------------------- */

type Bucket = { hits: number[] };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, max = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= max) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  if (buckets.size > 5000) buckets.clear();
  return true;
}

/* -------------------------------- sanitize -------------------------------- */

export function cleanText(value: unknown, max = 2000): string {
  if (typeof value !== "string") return "";
  // strip control characters, then neutralise angle brackets (XSS defence in depth)
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim()
    .slice(0, max);
}

export function slugifyTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]/g, "")
    .slice(0, 40);
}
