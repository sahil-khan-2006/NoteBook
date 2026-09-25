import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, cleanText, rateLimit } from "@/lib/security";
import { clientKey } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Password recovery. In a production deployment this issues a single-use,
 * time-limited token and emails it to the college address; the token is
 * returned here so the flow is fully exercisable in the demo environment.
 */
const tokens = new Map<string, { email: string; exp: number }>();

export async function POST(req: Request) {
  return handler(async () => {
    const key = await clientKey("forgot");
    if (!rateLimit(key, 6, 60_000)) return fail(429, "Too many requests. Try again shortly.");

    const body = await req.json().catch(() => ({}));
    const step = String(body.step ?? "request");

    if (step === "request") {
      const email = cleanText(body.email, 160).toLowerCase();
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const token = `reset_${Math.random().toString(36).slice(2, 10)}`;
      if (user) tokens.set(token, { email, exp: Date.now() + 15 * 60_000 });
      return ok({
        ok: true,
        // Echoed in-demo so the reset step can be completed without a mail server.
        token: user ? token : null,
        message: "If that address exists, a reset link has been issued.",
      });
    }

    const token = cleanText(body.token, 64);
    const next = String(body.newPassword ?? "");
    const record = tokens.get(token);
    if (!record || record.exp < Date.now())
      return fail(400, "This reset link is invalid or has expired.");
    if (next.length < 8) return fail(400, "Password must be at least 8 characters.");

    const [user] = await db.select().from(users).where(eq(users.email, record.email)).limit(1);
    if (!user) return fail(404, "Account not found.");
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(next) })
      .where(eq(users.id, user.id));
    tokens.delete(token);
    return ok({ ok: true, message: "Password updated. You can sign in now." });
  });
}
