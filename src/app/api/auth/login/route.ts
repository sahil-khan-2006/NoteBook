import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, rateLimit, cleanText } from "@/lib/security";
import { createSession, clientKey } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handler(async () => {
    const key = await clientKey("login");
    if (!rateLimit(key, 12, 60_000))
      return fail(429, "Too many login attempts. Please wait a minute.");

    const body = await req.json().catch(() => ({}));
    const email = cleanText(body.email, 160).toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return fail(400, "Email and password are required.");

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    // constant-ish response to avoid account enumeration
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !valid) return fail(401, "Incorrect email or password.");
    if (user.status === "deleted") return fail(401, "Incorrect email or password.");
    if (user.status === "suspended")
      return fail(403, "This account has been suspended. Contact the administrator.");

    await db
      .update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, user.id));
    await createSession(user.id, Boolean(body.remember));
    return ok({ id: user.id, role: user.role });
  });
}
