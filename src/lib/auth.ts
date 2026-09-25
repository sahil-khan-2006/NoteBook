import { cookies, headers } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { signSession, verifySession } from "@/lib/security";

export const SESSION_COOKIE = "bpm_session";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string, remember: boolean) {
  const jar = await cookies();
  const token = signSession({
    uid: userId,
    exp: Date.now() + (remember ? THIRTY_DAYS : 12 * 60 * 60 * 1000),
    remember,
  });
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? THIRTY_DAYS / 1000 : 12 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export const getSessionUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const payload = verifySession(token);
  if (!payload) return null;
  const [row] = await db.select().from(users).where(eq(users.id, payload.uid)).limit(1);
  if (!row || row.status === "deleted") return null;
  return row;
});

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Not authenticated");
  if (user.status === "suspended") throw new AuthError(403, "Account suspended");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AuthError(403, "Administrator access required");
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Best-effort client identity for rate limiting. */
export async function clientKey(prefix: string): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${prefix}:${fwd || h.get("x-real-ip") || "local"}`;
}
