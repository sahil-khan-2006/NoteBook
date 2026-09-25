import { and, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { posts, likes, saves, reports } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { cleanText, rateLimit } from "@/lib/security";
import { notify } from "@/lib/activity";

export const runtime = "nodejs";

type Body = { action: string; reason?: string };

async function scalar(q: SQL): Promise<number> {
  const res = await db.execute(q);
  const row = res.rows[0] as { n?: number | string } | undefined;
  return Number(row?.n ?? 0);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handler(async () => {
    const user = await requireUser();
    if (!rateLimit(`engage:${user.id}`, 60, 60_000))
      return fail(429, "Slow down a little.");
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Body;
    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!post) return fail(404, "Resource not found.");

    if (body.action === "like") {
      const existing = await db
        .select({ postId: likes.postId })
        .from(likes)
        .where(and(eq(likes.userId, user.id), eq(likes.postId, id)))
        .limit(1);
      if (existing.length) {
        await db.delete(likes).where(and(eq(likes.userId, user.id), eq(likes.postId, id)));
        const count = await scalar(sql`select count(*)::int as n from likes where post_id = ${id}`);
        return ok({ liked: false, count });
      }
      await db.insert(likes).values({ userId: user.id, postId: id }).onConflictDoNothing();
      const count = await scalar(sql`select count(*)::int as n from likes where post_id = ${id}`);
      await notify({
        userId: post.authorId,
        actorId: user.id,
        type: "like",
        postId: id,
        body: `liked your ${post.kind === "request" ? "request" : (post.resourceType ?? "resource")} — ${post.title}`,
      });
      if (post.kind === "request") {
        await notify({
          userId: post.authorId,
          actorId: user.id,
          type: "request_interact",
          postId: id,
          body: `is interested in your request: ${post.title}`,
        });
      }
      return ok({ liked: true, count });
    }

    if (body.action === "save") {
      const existing = await db
        .select({ postId: saves.postId })
        .from(saves)
        .where(and(eq(saves.userId, user.id), eq(saves.postId, id)))
        .limit(1);
      if (existing.length) {
        await db.delete(saves).where(and(eq(saves.userId, user.id), eq(saves.postId, id)));
        const count = await scalar(sql`select count(*)::int as n from saves where post_id = ${id}`);
        return ok({ saved: false, count });
      }
      await db.insert(saves).values({ userId: user.id, postId: id }).onConflictDoNothing();
      const count = await scalar(sql`select count(*)::int as n from saves where post_id = ${id}`);
      return ok({ saved: true, count });
    }

    if (body.action === "download") {
      if (!post.filePath) return fail(400, "This resource has no downloadable file.");
      await db.update(posts).set({ downloads: sql`${posts.downloads} + 1` }).where(eq(posts.id, id));
      const downloads = await scalar(sql`select downloads::int as n from posts where id = ${id}`);
      return ok({ downloads });
    }

    if (body.action === "report") {
      const reason = cleanText(body.reason, 400);
      if (!reason) return fail(400, "Please tell us why you are reporting this.");
      await db.insert(reports).values({
        reporterId: user.id,
        targetType: post.kind === "request" ? "request" : "post",
        targetId: id,
        label: post.title.slice(0, 190),
        reason,
      });
      return ok({ ok: true, message: "Report submitted for review." });
    }

    return fail(400, "Unknown action.");
  });
}
