import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, userSubjects, subjects } from "@/db/schema";
import { getSessionUser, createSession } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { hashPassword, verifyPassword, cleanText, rateLimit } from "@/lib/security";
import { profileStats, getStreak, rankOf, unreadCount } from "@/lib/activity";
import { BRANCHES, SEMESTERS } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET() {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) return fail(401, "Not authenticated");
    const [stats, streak, rank, unread, subs] = await Promise.all([
      profileStats(user.id),
      getStreak(user.id),
      rankOf(user.id),
      unreadCount(user.id),
      db
        .select({ name: subjects.name, id: subjects.id })
        .from(userSubjects)
        .innerJoin(subjects, eq(subjects.id, userSubjects.subjectId))
        .where(eq(userSubjects.userId, user.id)),
    ]);
    const { passwordHash: _ignored, ...safe } = user;
    void _ignored;
    return ok({ user: safe, stats, streak, rank, unread, subjects: subs.map((s) => s.name) });
  });
}

export async function PATCH(req: Request) {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) return fail(401, "Not authenticated");
    if (!rateLimit(`profile:${user.id}`, 20, 60_000)) return fail(429, "Too many requests.");

    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};

    if (body.fullName !== undefined) {
      const v = cleanText(body.fullName, 120);
      if (v.length < 3) return fail(400, "Name is too short.");
      patch.fullName = v;
    }
    if (body.bio !== undefined) patch.bio = cleanText(body.bio, 240);
    if (body.branch !== undefined) {
      if (!(BRANCHES as readonly string[]).includes(body.branch))
        return fail(400, "Invalid branch.");
      patch.branch = body.branch;
    }
    if (body.semester !== undefined) {
      const s = Number(body.semester);
      if (!(SEMESTERS as readonly number[]).includes(s)) return fail(400, "Invalid semester.");
      patch.semester = s;
    }
    if (body.currentPassword || body.newPassword) {
      const okPw = await verifyPassword(String(body.currentPassword ?? ""), user.passwordHash);
      if (!okPw) return fail(400, "Current password is incorrect.");
      const next = String(body.newPassword ?? "");
      if (next.length < 8) return fail(400, "New password must be at least 8 characters.");
      patch.passwordHash = await hashPassword(next);
      await createSession(user.id, true);
    }
    if (Object.keys(patch).length) {
      await db.update(users).set(patch).where(eq(users.id, user.id));
    }
    return ok({ ok: true });
  });
}
