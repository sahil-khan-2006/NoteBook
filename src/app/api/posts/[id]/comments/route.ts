import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, users, posts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { cleanText, rateLimit } from "@/lib/security";
import { notify } from "@/lib/activity";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  return handler(async () => {
    const { id } = await params;
    const url = new URL(req.url);
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));

    const rows = await db
      .select({
        id: comments.id,
        parentId: comments.parentId,
        body: comments.body,
        createdAt: comments.createdAt,
        authorId: users.id,
        fullName: users.fullName,
        branch: users.branch,
        semester: users.semester,
        avatarUrl: users.avatarUrl,
        rollNumber: users.rollNumber,
      })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(eq(comments.postId, id))
      .orderBy(asc(comments.createdAt))
      .limit(500);

    const total = rows.length;
    const roots = rows.filter((r) => !r.parentId).slice(offset, offset + limit);
    const rootIds = new Set(roots.map((r) => r.id));
    const children = rows.filter((r) => r.parentId && rootIds.has(r.parentId));
    const shape = (r: (typeof rows)[number]) => ({
      id: r.id,
      parentId: r.parentId,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      isAuthor: false,
      author: {
        id: r.authorId,
        fullName: r.fullName,
        branch: r.branch,
        semester: r.semester,
        avatarUrl: r.avatarUrl,
        rollNumber: r.rollNumber,
      },
    });
    return ok({
      items: roots.map((r) => ({
        ...shape(r),
        replies: children.filter((c) => c.parentId === r.id).map(shape),
      })),
      total,
      nextOffset: offset + limit < total ? offset + limit : null,
    });
  });
}

export async function POST(req: Request, { params }: Params) {
  return handler(async () => {
    const user = await requireUser();
    if (!rateLimit(`comment:${user.id}`, 30, 60_000))
      return fail(429, "You are commenting too quickly.");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const text = cleanText(body.body, 600);
    if (!text) return fail(400, "Write something first.");
    const parentId = typeof body.parentId === "string" ? body.parentId : null;

    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!post) return fail(404, "Resource not found.");

    if (parentId) {
      const [parent] = await db
        .select({ id: comments.id, authorId: comments.authorId })
        .from(comments)
        .where(eq(comments.id, parentId))
        .limit(1);
      if (!parent) return fail(404, "Comment not found.");
      await notify({
        userId: parent.authorId,
        actorId: user.id,
        type: "reply",
        postId: id,
        body: `replied to your comment on ${post.title}`,
      });
    } else {
      await notify({
        userId: post.authorId,
        actorId: user.id,
        type: "comment",
        postId: id,
        body: `commented on your ${post.kind === "request" ? "request" : "resource"} — ${post.title}`,
      });
    }

    const [row] = await db
      .insert(comments)
      .values({ postId: id, authorId: user.id, parentId, body: text })
      .returning();

    const countRes = await db.execute(
      sql`select count(*)::int as n from comments where post_id = ${id}`,
    );
    return ok({
      comment: {
        id: row.id,
        parentId: row.parentId,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        isAuthor: true,
        author: {
          id: user.id,
          fullName: user.fullName,
          branch: user.branch,
          semester: user.semester,
          avatarUrl: user.avatarUrl,
          rollNumber: user.rollNumber,
        },
        replies: [],
      },
      count: Number(
        (countRes.rows[0] as { n?: number } | undefined)?.n ?? 0,
      ),
    });
  });
}

export async function DELETE(req: Request) {
  return handler(async () => {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "");
    if (!id) return fail(400, "Comment id required.");
    const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (!row) return fail(404, "Comment not found.");
    if (row.authorId !== user.id && user.role !== "admin")
      return fail(403, "You can only delete your own comments.");
    await db.delete(comments).where(eq(comments.id, id));
    return ok({ ok: true });
  });
}
