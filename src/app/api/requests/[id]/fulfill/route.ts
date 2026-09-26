import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts, tags, postTags, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { cleanText, slugifyTag, rateLimit } from "@/lib/security";
import { saveUpload, validateFile, isUploadableFile } from "@/lib/uploads";
import { notify } from "@/lib/activity";
import { RESOURCE_TYPES } from "@/lib/constants";

export const runtime = "nodejs";

/** Fulfil an open resource request — either by uploading a file now, or by
 *  attaching an existing resource the student has already published. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handler(async () => {
    const user = await requireUser();
    if (!rateLimit(`fulfil:${user.id}`, 10, 60_000))
      return fail(429, "Too many fulfilment attempts. Try again shortly.");
    const { id } = await params;

    const [request] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    if (!request) return fail(404, "Request not found.");
    if (request.kind !== "request") return fail(400, "That post is not a request.");
    if (request.status === "fulfilled")
      return fail(409, "This request has already been fulfilled.");
    if (request.authorId === user.id)
      return fail(400, "You cannot fulfil your own request. Wait for a peer.");

    const contentType = req.headers.get("content-type") ?? "";
    let createdPostId: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      const existingId = String(body.existingPostId ?? "");
      if (!existingId) return fail(400, "Attach a file or choose one of your resources.");
      const [existing] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, existingId))
        .limit(1);
      if (!existing) return fail(404, "That resource no longer exists.");
      if (existing.authorId !== user.id) return fail(403, "That resource is not yours.");
      createdPostId = existing.id;
    } else {
      const form = await req.formData();
      const title = cleanText(form.get("title"), 200) || request.title;
      const description = cleanText(form.get("description"), 2000);
      const resourceType =
        cleanText(form.get("resourceType"), 40) ||
        request.resourceType ||
        RESOURCE_TYPES[0];
      const file = form.get("file");
      if (!isUploadableFile(file) || file.size === 0)
        return fail(400, "Attach the resource file so others can use it.");
      const err = validateFile(file);
      if (err) return fail(400, err);
      const stored = await saveUpload(file, "fulfil");

      const [post] = await db
        .insert(posts)
        .values({
          authorId: user.id,
          kind: "resource",
          title,
          description: description || null,
          branch: request.branch,
          semester: request.semester,
          subject: request.subject,
          unit: request.unit,
          resourceType,
          status: "open",
          fileName: stored.originalName,
          filePath: stored.storedName,
          fileSize: stored.size,
          mimeType: stored.mime,
        })
        .returning({ id: posts.id });
      createdPostId = post.id;

      const rawTags = String(form.get("tags") ?? "");
      const wanted = [
        ...rawTags
          .split(/[,\s]+/)
          .map((t) => slugifyTag(t.startsWith("#") ? t.slice(1) : t))
          .filter(Boolean),
        ...(request.subject ? [slugifyTag(request.subject)] : []),
      ].slice(0, 8);
      if (wanted.length) {
        const existing = await db.select().from(tags);
        const byName = new Map(existing.map((t) => [t.name, t.id]));
        const missing = wanted.filter((t) => !byName.has(t));
        if (missing.length) {
          const inserted = await db
            .insert(tags)
            .values(missing.map((name) => ({ name })))
            .onConflictDoNothing()
            .returning();
          for (const t of inserted) byName.set(t.name, t.id);
        }
        const link = wanted
          .map((t) => byName.get(t))
          .filter((n): n is number => Boolean(n))
          .map((tagId) => ({ postId: post.id, tagId }));
        if (link.length) await db.insert(postTags).values(link).onConflictDoNothing();
      }
      if (request.subject)
        await db.insert(subjects).values({ name: request.subject }).onConflictDoNothing();
    }

    await db
      .update(posts)
      .set({ status: "fulfilled", fulfilledBy: user.id, fulfilledPostId: createdPostId })
      .where(eq(posts.id, id));

    await notify({
      userId: request.authorId,
      actorId: user.id,
      type: "fulfill",
      postId: id,
      body: `fulfilled your request — ${request.title}`,
    });

    return ok({
      ok: true,
      fulfilledPostId: createdPostId,
      message: "Request marked as fulfilled.",
    });
  });
}
