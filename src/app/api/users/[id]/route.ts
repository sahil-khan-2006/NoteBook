import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, follows, userSubjects, subjects, posts, reports } from "@/db/schema";
import { getSessionUser, requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { profileStats, getStreak, rankOf } from "@/lib/activity";
import { cleanText, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handler(async () => {
    const { id } = await params;
    const viewer = await getSessionUser();
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user || user.status === "deleted") return fail(404, "Student not found.");

    const [stats, streak, rank, followRow, subs, recent] = await Promise.all([
      profileStats(user.id),
      getStreak(user.id),
      rankOf(user.id),
      viewer && viewer.id !== user.id
        ? db
            .select({ id: follows.followerId })
            .from(follows)
            .where(
              sql`${eq(follows.followerId, viewer.id)} and ${eq(follows.followingId, user.id)}`,
            )
            .limit(1)
        : Promise.resolve([]),
      db
        .select({ name: subjects.name })
        .from(userSubjects)
        .innerJoin(subjects, eq(subjects.id, userSubjects.subjectId))
        .where(eq(userSubjects.userId, user.id)),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(posts)
        .where(eq(posts.authorId, user.id)),
    ]);

    const { passwordHash: _ph, ...safe } = user;
    void _ph;
    return ok({
      user: safe,
      stats,
      streak,
      rank,
      subjects: subs.map((s) => s.name),
      isFollowing: followRow.length > 0,
      isSelf: viewer?.id === user.id,
    });
  });
}

/** Report a student, comment or post from anywhere in the app. */
export async function POST(req: Request) {
  return handler(async () => {
    const user = await requireUser();
    if (!rateLimit(`report:${user.id}`, 10, 60_000)) return fail(429, "Too many reports.");
    const body = await req.json().catch(() => ({}));
    const targetType = cleanText(body.targetType, 24);
    const targetId = cleanText(body.targetId, 64);
    const reason = cleanText(body.reason, 400);
    if (!targetId || !reason) return fail(400, "Missing report details.");
    const label = cleanText(body.label, 190);
    await db
      .insert(reports)
      .values({ reporterId: user.id, targetType, targetId, label, reason });
    return ok({ ok: true, message: "Report submitted for review." });
  });
}
