import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { posts, tags, postTags, subjects } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { cleanText, slugifyTag, rateLimit } from "@/lib/security";
import { fetchPosts, type FeedFilters, type PostDto } from "@/lib/feed";
import { saveUpload, validateFile, isUploadableFile } from "@/lib/uploads";
import {
  bumpStreak,
  notify,
  notifyFollowersOfNewResource,
} from "@/lib/activity";
import { RESOURCE_TYPES, BRANCHES, SEMESTERS, MAX_FILE_BYTES } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handler(async () => {
    await requireUser();
    const url = new URL(req.url);
    const p = url.searchParams;
    const offset = Math.max(0, Number(p.get("offset") ?? 0) || 0);
    const limit = Math.min(20, Math.max(1, Number(p.get("limit") ?? 8) || 8));

    const filters: FeedFilters = {
      tab: (p.get("tab") as "for-you" | "following") || "for-you",
      kind: (p.get("kind") as "resource" | "request") || undefined,
      branch: p.get("branch") || undefined,
      semester: p.get("semester") ? Number(p.get("semester")) : undefined,
      resourceType: p.get("type") || undefined,
      subject: p.get("subject") || undefined,
      tag: p.get("tag") || undefined,
      q: p.get("q") || undefined,
      authorId: p.get("author") || undefined,
      savedBy: p.get("saved") || undefined,
      fulfilled:
        p.get("fulfilled") == null ? undefined : p.get("fulfilled") === "true",
    };

    const { getSessionUser } = await import("@/lib/auth");
    const viewer = await getSessionUser();
    const result = await fetchPosts(filters, viewer?.id ?? null, limit, offset);
    return ok(result);
  });
}

export async function POST(req: Request) {
  return handler(async () => {
    const user = await requireUser();
    if (!rateLimit(`post:${user.id}`, 12, 60_000))
      return fail(429, "You are posting too quickly. Take a breath.");

    const form = await req.formData();
    const kind = String(form.get("kind") ?? "resource") as "resource" | "request";
    const title = cleanText(form.get("title"), 200);
    const description = cleanText(form.get("description"), 2000);
    const branch = cleanText(form.get("branch"), 48) || user.branch;
    const semesterRaw = Number(form.get("semester") || user.semester);
    const subject = cleanText(form.get("subject"), 120);
    const unit = cleanText(form.get("unit"), 40);
    const resourceType = cleanText(form.get("resourceType"), 40);
    const rawTags = String(form.get("tags") ?? "");
    const file = form.get("file");
    const thumb = form.get("thumb");

    if (title.length < 4) return fail(400, "Please give your post a clear title.");
    if (!(BRANCHES as readonly string[]).includes(branch))
      return fail(400, "Please choose a valid branch.");
    if (!(SEMESTERS as readonly number[]).includes(semesterRaw))
      return fail(400, "Please choose a valid semester.");
    if (kind !== "request" && kind !== "resource")
      return fail(400, "Unknown post type.");
    if (kind === "resource" && !resourceType)
      return fail(400, "Please choose a resource type.");
    if (
      resourceType &&
      !(RESOURCE_TYPES as readonly string[]).includes(resourceType)
    )
      return fail(400, "Please choose a valid resource type.");

    let stored: Awaited<ReturnType<typeof saveUpload>> | null = null;
    if (file && isUploadableFile(file) && file.size > 0) {
      const err = validateFile(file);
      if (err) return fail(400, err);
      stored = await saveUpload(file, kind === "request" ? "req" : "res");
    }
    let thumbStored: Awaited<ReturnType<typeof saveUpload>> | null = null;
    if (thumb && isUploadableFile(thumb) && thumb.size > 0) {
      if (thumb.size > MAX_FILE_BYTES) return fail(400, "Cover image is too large.");
      thumbStored = await saveUpload(thumb, "thumb");
    }

    if (kind === "resource" && !stored && !thumbStored)
      return fail(400, "Attach a file or a cover image for your resource.");

    const [post] = await db
      .insert(posts)
      .values({
        authorId: user.id,
        kind,
        title,
        description: description || null,
        branch,
        semester: semesterRaw,
        subject: subject || null,
        unit: unit || null,
        resourceType: resourceType || null,
        status: "open",
        fileName: stored?.originalName ?? null,
        filePath: stored?.storedName ?? null,
        fileSize: stored?.size ?? null,
        mimeType: stored?.mime ?? null,
        filePages: null,
        thumbUrl: thumbStored?.storedName ?? null,
      })
      .returning({ id: posts.id });

    // tags
    const wanted = rawTags
      .split(/[,\s]+/)
      .map((t) => (t.startsWith("#") ? t.slice(1) : t))
      .map(slugifyTag)
      .filter(Boolean)
      .slice(0, 8);
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
        .filter((id): id is number => Boolean(id))
        .map((tagId) => ({ postId: post.id, tagId }));
      if (link.length) await db.insert(postTags).values(link).onConflictDoNothing();
    }

    // subject registry (dynamic)
    if (subject) {
      await db.insert(subjects).values({ name: subject }).onConflictDoNothing();
    }

    const streak = await bumpStreak(user.id);
    if (kind === "resource") {
      await notifyFollowersOfNewResource(user.id, post.id);
    } else {
      const watchers = await db.execute(sql`
        select id from users where branch = ${branch} and id <> ${user.id} limit 12
      `);
      await Promise.all(
        watchers.rows.map((r) =>
          notify({
            userId: String((r as { id: string }).id),
            actorId: user.id,
            type: "request_interact",
            postId: post.id,
            body: `is looking for ${subject || title}`,
          }),
        ),
      );
    }

    const { items } = await fetchPosts({ authorId: user.id }, user.id, 1, 0);
    return ok({ id: post.id, streak, post: (items[0] as PostDto) ?? null });
  });
}
