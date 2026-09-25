import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users, posts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handler(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        body: notifications.body,
        read: notifications.read,
        postId: notifications.postId,
        createdAt: notifications.createdAt,
        actorId: users.id,
        fullName: users.fullName,
        branch: users.branch,
        semester: users.semester,
        avatarUrl: users.avatarUrl,
        rollNumber: users.rollNumber,
        postTitle: posts.title,
        postKind: posts.kind,
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .leftJoin(posts, eq(posts.id, notifications.postId))
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(100);

    const unread = await db.execute(
      sql`select count(*)::int as n from notifications where user_id = ${user.id} and read = false`,
    );

    return ok({
      items: rows.slice(offset, offset + 20).map((r) => ({
        id: r.id,
        type: r.type,
        body: r.body,
        read: r.read,
        postId: r.postId,
        postTitle: r.postTitle,
        postKind: r.postKind,
        createdAt: r.createdAt.toISOString(),
        actor: r.actorId
          ? {
              id: r.actorId,
              fullName: r.fullName,
              branch: r.branch,
              semester: r.semester,
              avatarUrl: r.avatarUrl,
              rollNumber: r.rollNumber,
            }
          : null,
      })),
      total: rows.length,
      unread: Number((unread.rows[0] as { n: number } | undefined)?.n ?? 0),
      nextOffset: offset + 20 < rows.length ? offset + 20 : null,
    });
  });
}

export async function PATCH(req: Request) {
  return handler(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    if (body.all === true) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(eq(notifications.userId, user.id), eq(notifications.read, false)),
        );
      return ok({ ok: true });
    }
    const id = String(body.id ?? "");
    if (!id) return fail(400, "Notification id required.");
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, user.id), eq(notifications.id, id)));
    return ok({ ok: true });
  });
}
