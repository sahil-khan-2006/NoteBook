import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { subjects, userSubjects, posts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { cleanText, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

export async function GET() {
  return handler(async () => {
    const user = await requireUser();
    const [mine, all] = await Promise.all([
      db
        .select({ id: subjects.id, name: subjects.name })
        .from(userSubjects)
        .innerJoin(subjects, eq(subjects.id, userSubjects.subjectId))
        .where(eq(userSubjects.userId, user.id)),
      db.execute(sql`
        select s.id, s.name,
          (select count(*)::int from posts p where lower(p.subject) = lower(s.name)) as post_count,
          (select count(*)::int from user_subjects us where us.subject_id = s.id) as followers
        from subjects s order by post_count desc, s.name asc limit 60
      `),
    ]);
    const mineSet = new Set(mine.map((m) => m.id));
    return ok({
      mine: mine.map((m) => m.name),
      all: (all.rows as Record<string, unknown>[]).map((r) => ({
        id: Number(r.id),
        name: String(r.name),
        posts: Number(r.post_count),
        followers: Number(r.followers),
        following: mineSet.has(Number(r.id)),
      })),
    });
  });
}

/** Toggle a subject on the student's "My Subjects" list. */
export async function POST(req: Request) {
  return handler(async () => {
    const user = await requireUser();
    if (!rateLimit(`subject:${user.id}`, 30, 60_000)) return fail(429, "Too many requests.");
    const body = await req.json().catch(() => ({}));
    const name = cleanText(body.name, 120);
    if (!name) return fail(400, "Pick a subject first.");

    const [existing] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(sql`lower(${subjects.name})`, name.toLowerCase()))
      .limit(1);
    let subjectId = existing?.id;
    if (!subjectId) {
      const [created] = await db
        .insert(subjects)
        .values({ name })
        .onConflictDoNothing()
        .returning();
      subjectId = created?.id;
    }
    if (!subjectId) return fail(500, "Could not save subject.");

    const link = await db
      .select({ subjectId: userSubjects.subjectId })
      .from(userSubjects)
      .where(
        and(eq(userSubjects.userId, user.id), eq(userSubjects.subjectId, subjectId)),
      )
      .limit(1);

    if (link.length) {
      await db
        .delete(userSubjects)
        .where(
          and(eq(userSubjects.userId, user.id), eq(userSubjects.subjectId, subjectId)),
        );
      return ok({ following: false });
    }
    await db
      .insert(userSubjects)
      .values({ userId: user.id, subjectId })
      .onConflictDoNothing();
    return ok({ following: true });
  });
}
