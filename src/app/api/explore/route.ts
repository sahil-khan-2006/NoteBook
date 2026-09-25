import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects, userSubjects, posts } from "@/db/schema";
import { handler, ok, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { fetchPosts } from "@/lib/feed";

export const runtime = "nodejs";

/** Explore: one request returns users, resources, requests, subjects and tags. */
export async function GET(req: Request) {
  return handler(async () => {
    const url = new URL(req.url);
    const p = url.searchParams;
    const q = (p.get("q") ?? "").trim();
    const viewer = await getSessionUser();
    if (!viewer) return fail(401, "Not authenticated");
    const like = `%${q.toLowerCase()}%`;

    const filters = {
      tab: "for-you" as const,
      q: q || undefined,
      kind: (p.get("kind") as "resource" | "request") || undefined,
      branch: p.get("branch") || undefined,
      semester: p.get("semester") ? Number(p.get("semester")) : undefined,
      resourceType: p.get("type") || undefined,
      subject: p.get("subject") || undefined,
    };

    const [resources, people, subjectList, tagList, trending] = await Promise.all([
      fetchPosts(filters, viewer?.id ?? null, 12, Number(p.get("offset") ?? 0) || 0),
      q
        ? db.execute(sql`
            select id, full_name, branch, semester, avatar_url, roll_number,
                   (select count(*)::int from follows f where f.following_id = u.id) as followers,
                   (select count(*)::int from posts pp where pp.author_id = u.id) as post_count
            from users u
            where u.status = 'active' and (
              lower(u.full_name) like ${like}
              or lower(u.roll_number) like ${like}
              or lower(u.branch) like ${like}
            )
            order by followers desc limit 8
          `)
        : Promise.resolve({ rows: [] as unknown[] }),
      db.execute(sql`
        select s.id, s.name,
               (select count(*)::int from posts pp where lower(pp.subject) = lower(s.name)) as post_count
        from subjects s
        where ${q ? sql`lower(s.name) like ${like}` : sql`true`}
        order by post_count desc, s.name asc limit 14
      `),
      db.execute(sql`
        select t.name, count(*)::int as n
        from tags t join post_tags pt on pt.tag_id = t.id
        where ${q ? sql`lower(t.name) like ${like}` : sql`true`}
        group by t.name order by n desc limit 16
      `),
      trendingFeed(),
    ]);

    return ok({
      resources: resources.items,
      total: resources.total,
      nextOffset: resources.nextOffset,
      people: (people.rows as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        fullName: String(r.full_name),
        branch: String(r.branch),
        semester: Number(r.semester),
        avatarUrl: (r.avatar_url as string | null) ?? null,
        rollNumber: String(r.roll_number),
        followers: Number(r.followers),
        posts: Number(r.post_count),
      })),
      subjects: (subjectList.rows as Record<string, unknown>[]).map((r) => ({
        id: Number(r.id),
        name: String(r.name),
        posts: Number(r.post_count),
      })),
      tags: (tagList.rows as Record<string, unknown>[]).map((r) => ({
        name: String(r.name),
        count: Number(r.n),
      })),
      trending,
    });
  });
}

/** Engagement weighted toward the last 72 hours so old posts do not dominate. */
async function trendingFeed() {
  const rows = await db.execute(sql`
    select p.id, p.title, p.kind, p.resource_type, p.subject, p.thumb_url, p.created_at,
      au.full_name, au.branch, au.semester, au.avatar_url, au.roll_number,
      (select count(*)::int from likes l where l.post_id = p.id) * 3
      + (select count(*)::int from comments c where c.post_id = p.id) * 4
      + (select count(*)::int from saves s where s.post_id = p.id) * 5
      + p.views * 0.25 + p.downloads * 1.5
      + greatest(0, 60 - extract(epoch from (now() - p.created_at)) / 3600)::int * 1.5
      as score
    from posts p join users au on au.id = p.author_id
    where p.kind = 'resource'
    order by score desc limit 6
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    title: String(r.title),
    resourceType: (r.resource_type as string | null) ?? null,
    subject: (r.subject as string | null) ?? null,
    thumbUrl: (r.thumb_url as string | null) ?? null,
    createdAt: new Date(String(r.created_at)).toISOString(),
    score: Math.round(Number(r.score)),
    author: {
      fullName: String(r.full_name),
      branch: String(r.branch),
      semester: Number(r.semester),
      avatarUrl: (r.avatar_url as string | null) ?? null,
      rollNumber: String(r.roll_number),
    },
  }));
}


