import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { follows, users, posts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { notify } from "@/lib/activity";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handler(async () => {
    const user = await requireUser();
    const { id } = await params;
    if (id === user.id) return fail(400, "You cannot follow yourself.");

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target || target.status === "deleted") return fail(404, "Student not found.");

    const existing = await db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(
        and(eq(follows.followerId, user.id), eq(follows.followingId, id)),
      )
      .limit(1);

    if (existing.length) {
      await db
        .delete(follows)
        .where(and(eq(follows.followerId, user.id), eq(follows.followingId, id)));
      const f = await db.execute(
        sql`select count(*)::int as n from follows where following_id = ${id}`,
      );
      return ok({
        following: false,
        followers: Number((f.rows[0] as { n: number }).n),
      });
    }

    await db
      .insert(follows)
      .values({ followerId: user.id, followingId: id })
      .onConflictDoNothing();

    await notify({
      userId: id,
      actorId: user.id,
      type: "follow",
      body: "started following you",
    });

    const f = await db.execute(
      sql`select count(*)::int as n from follows where following_id = ${id}`,
    );

    return ok({
      following: true,
      followers: Number((f.rows[0] as { n: number }).n),
    });
  });
}
