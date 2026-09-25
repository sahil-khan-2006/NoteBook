import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { getSessionUser, requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { fetchPosts } from "@/lib/feed";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  return handler(async () => {
    const { id } = await params;
    const viewer = await getSessionUser();

    const { items } = await fetchPosts({ id }, viewer?.id ?? null, 1, 0);
    if (!items.length) return fail(404, "Resource not found.");
    const post = items[0];

    const updated = await db
      .update(posts)
      .set({ views: sql`${posts.views} + 1` })
      .where(eq(posts.id, id))
      .returning({ views: posts.views });

    const relatedBySubject = post.subject
      ? await fetchPosts(
          { subject: post.subject, kind: "resource" },
          viewer?.id ?? null,
          4,
          0,
        )
      : { items: [] };
    const relatedByTag = post.tags[0]
      ? await fetchPosts(
          { tag: post.tags[0], kind: "resource" },
          viewer?.id ?? null,
          4,
          0,
        )
      : { items: [] };

    return ok({
      post: { ...post, views: updated[0]?.views ?? post.views },
      related: [...relatedBySubject.items, ...relatedByTag.items]
        .filter((p, i, arr) => p.id !== id && arr.findIndex((x) => x.id === p.id) === i)
        .slice(0, 4),
    });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return handler(async () => {
    const user = await requireUser();
    const { id } = await params;
    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!post) return fail(404, "Resource not found.");
    if (post.authorId !== user.id && user.role !== "admin")
      return fail(403, "You can only remove your own posts.");
    await db.delete(posts).where(eq(posts.id, id));
    return ok({ ok: true });
  });
}
