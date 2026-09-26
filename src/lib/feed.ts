import { sql, eq, inArray, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { posts, users, likes, saves, comments, postTags, tags } from "@/db/schema";

export type AuthorDto = {
  id: string;
  fullName: string;
  branch: string;
  semester: number;
  avatarUrl: string | null;
  rollNumber: string;
  role?: string;
};

export type PostDto = {
  id: string;
  kind: "resource" | "request";
  title: string;
  description: string | null;
  branch: string | null;
  semester: number | null;
  subject: string | null;
  unit: string | null;
  resourceType: string | null;
  status: string;
  fileName: string | null;
  filePath: string | null;
  fileSize: number | null;
  filePages: number | null;
  mimeType: string | null;
  thumbUrl: string | null;
  views: number;
  downloads: number;
  createdAt: string;
  author: AuthorDto;
  tags: string[];
  likeCount: number;
  commentCount: number;
  saveCount: number;
  liked: boolean;
  saved: boolean;
  viewerIsAuthor: boolean;
  topComment: { author: AuthorDto; body: string } | null;
  fulfilledBy: AuthorDto | null;
  fulfilledPostId: string | null;
};

const toAuthor = (r: {
  id: string;
  fullName: string;
  branch: string;
  semester: number;
  avatarUrl: string | null;
  rollNumber: string;
  role?: string;
}): AuthorDto => ({
  id: r.id,
  fullName: r.fullName,
  branch: r.branch,
  semester: r.semester,
  avatarUrl: r.avatarUrl,
  rollNumber: r.rollNumber,
  role: r.role ?? "user",
});

export type FeedFilters = {
  tab?: "for-you" | "following";
  kind?: "resource" | "request";
  branch?: string;
  semester?: number;
  resourceType?: string;
  subject?: string;
  tag?: string;
  q?: string;
  id?: string;
  authorId?: string;
  savedBy?: string;
  fulfilled?: boolean;
};

export async function fetchPosts(
  filters: FeedFilters,
  viewerId: string | null,
  limit = 8,
  offset = 0,
): Promise<{ items: PostDto[]; nextOffset: number | null; total: number }> {
  // NOTE: the FROM clause aliases `posts` as `p`, so every predicate must be
  // written against that alias rather than through drizzle column helpers.
  const conds: (SQL | undefined)[] = [];
  if (filters.kind) conds.push(sql`p.kind = ${filters.kind}`);
  if (filters.branch) conds.push(sql`p.branch = ${filters.branch}`);
  if (filters.semester) conds.push(sql`p.semester = ${filters.semester}`);
  if (filters.resourceType) conds.push(sql`p.resource_type = ${filters.resourceType}`);
  if (filters.subject) conds.push(sql`p.subject = ${filters.subject}`);
  if (filters.authorId) conds.push(sql`p.author_id = ${filters.authorId}`);
  if (filters.id) conds.push(sql`p.id = ${filters.id}`);
  if (filters.fulfilled !== undefined)
    conds.push(
      sql`p.status = ${filters.fulfilled ? "fulfilled" : "open"}`,
    );
  if (filters.savedBy)
    conds.push(
      sql`p.id in (select post_id from saves where user_id = ${filters.savedBy})`,
    );

  const usable = conds.filter((c): c is SQL => Boolean(c));
  let where: SQL | undefined = usable.length ? usable[0] : undefined;
  for (let i = 1; i < usable.length; i++) where = sql`${where} and ${usable[i]}`;

  // Full-text-ish search across title/description/subject/tags
  if (filters.q && filters.q.trim()) {
    const q = `%${filters.q.trim().toLowerCase()}%`;
    where = sql`${where ?? sql`true`} and (
      lower(p.title) like ${q} or lower(coalesce(p.description,'')) like ${q}
      or lower(coalesce(p.subject,'')) like ${q} or lower(coalesce(p.resource_type,'')) like ${q}
      or exists (select 1 from post_tags pt join tags tg on tg.id = pt.tag_id
                 where pt.post_id = p.id and lower(tg.name) like ${q})
    )`;
  }

  if (filters.tag) {
    const t = `%${filters.tag.toLowerCase()}%`;
    where = sql`${where ?? sql`true`} and exists (
      select 1 from post_tags pt join tags tg on tg.id = pt.tag_id
      where pt.post_id = p.id and lower(tg.name) like ${t}
    )`;
  }

  if (filters.tab === "following" && viewerId) {
    where = sql`${where ?? sql`true`} and (
      p.author_id = ${viewerId} or p.author_id in (
        select following_id from follows where follower_id = ${viewerId}
      )
    )`;
  } else if (filters.tab === "following" && !viewerId) {
    where = sql`false`;
  }

  // "For You": subject followings + branch affinity float to the top, recency still rules
  const ordering =
    filters.tab === "for-you" && viewerId
      ? sql`(
          case when p.author_id in (select following_id from follows where follower_id = ${viewerId}) then 3
               when p.subject in (select s.name from user_subjects us join subjects s on s.id = us.subject_id where us.user_id = ${viewerId}) then 2
               when p.branch = (select branch from users where id = ${viewerId}) then 1
               else 0 end
        ) desc, p.created_at desc`
      : sql`p.created_at desc`;

  const base = sql`from posts p join users au on au.id = p.author_id`;

  const totalRows = await db.execute(
    sql`select count(*)::int as n ${base} where ${where ?? sql`true`}`,
  );
  const total = Number(
    (totalRows.rows[0] as { n: number } | undefined)?.n ?? 0,
  );

  const rows = (await db.execute(sql`
    select p.id, p.author_id, p.kind, p.title, p.description, p.branch, p.semester,
      p.subject, p.unit, p.resource_type, p.status, p.file_name, p.file_path, p.file_size,
      p.file_pages, p.mime_type, p.thumb_url, p.views, p.downloads, p.created_at,
      p.fulfilled_post_id,
      au.full_name, au.branch as au_branch, au.semester as au_semester,
      au.avatar_url, au.roll_number, au.role as au_role,
      fu.full_name as fu_name, fu.branch as fu_branch, fu.semester as fu_semester,
      fu.avatar_url as fu_avatar, fu.roll_number as fu_roll, fu.role as fu_role
    ${base}
    left join users fu on fu.id = p.fulfilled_by
    where ${where ?? sql`true`}
    order by ${ordering}
    limit ${limit} offset ${offset}
  `)).rows as unknown as Record<string, unknown>[];

  const items = await decorate(rows, viewerId);
  const nextOffset = offset + limit < total ? offset + limit : null;
  return { items, nextOffset, total };
}

async function decorate(
  rows: Record<string, unknown>[],
  viewerId: string | null,
): Promise<PostDto[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => String(r.id));

  const [likeCounts, commentCounts, saveCounts, myLikes, mySaves, tagRows, topComments] =
    await Promise.all([
      db
        .select({ postId: likes.postId, n: sql<number>`count(*)::int` })
        .from(likes)
        .where(inArray(likes.postId, ids))
        .groupBy(likes.postId),
      db
        .select({ postId: comments.postId, n: sql<number>`count(*)::int` })
        .from(comments)
        .where(inArray(comments.postId, ids))
        .groupBy(comments.postId),
      db
        .select({ postId: saves.postId, n: sql<number>`count(*)::int` })
        .from(saves)
        .where(inArray(saves.postId, ids))
        .groupBy(saves.postId),
      viewerId
        ? db
            .select({ postId: likes.postId })
            .from(likes)
            .where(
              sql`${inArray(likes.postId, ids)} and ${eq(likes.userId, viewerId)}`,
            )
        : Promise.resolve([]),
      viewerId
        ? db
            .select({ postId: saves.postId })
            .from(saves)
            .where(
              sql`${inArray(saves.postId, ids)} and ${eq(saves.userId, viewerId)}`,
            )
        : Promise.resolve([]),
      db
        .select({ postId: postTags.postId, name: tags.name })
        .from(postTags)
        .innerJoin(tags, eq(tags.id, postTags.tagId))
        .where(inArray(postTags.postId, ids)),
      db
        .select({
          postId: comments.postId,
          body: comments.body,
          authorId: users.id,
          fullName: users.fullName,
          branch: users.branch,
          semester: users.semester,
          avatarUrl: users.avatarUrl,
          rollNumber: users.rollNumber,
        })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.authorId))
        .where(sql`${inArray(comments.postId, ids)} and ${isNull(comments.parentId)}`)
        .orderBy(comments.createdAt)
        .limit(200),
    ]);

  const mapCount = (arr: { postId: string; n: number }[]) =>
    new Map(arr.map((r) => [r.postId, Number(r.n)]));
  const likeMap = mapCount(likeCounts as never);
  const commentMap = mapCount(commentCounts as never);
  const saveMap = mapCount(saveCounts as never);
  const likedSet = new Set((myLikes as { postId: string }[]).map((r) => r.postId));
  const savedSet = new Set((mySaves as { postId: string }[]).map((r) => r.postId));
  const tagMap = new Map<string, string[]>();
  for (const t of tagRows) {
    const list = tagMap.get(t.postId) ?? [];
    list.push(t.name);
    tagMap.set(t.postId, list);
  }
  const topMap = new Map<string, { author: AuthorDto; body: string }>();
  for (const c of topComments) {
    topMap.set(c.postId, {
      body: c.body,
      author: toAuthor({
        id: c.authorId,
        fullName: c.fullName,
        branch: c.branch,
        semester: c.semester,
        avatarUrl: c.avatarUrl,
        rollNumber: c.rollNumber,
      }),
    });
  }

  return rows.map((r) => {
    const id = String(r.id);
    return {
      id,
      kind: r.kind as "resource" | "request",
      title: String(r.title),
      description: (r.description as string | null) ?? null,
      branch: (r.branch as string | null) ?? null,
      semester: (r.semester as number | null) ?? null,
      subject: (r.subject as string | null) ?? null,
      unit: (r.unit as string | null) ?? null,
      resourceType: (r.resource_type as string | null) ?? null,
      status: String(r.status),
      fileName: (r.file_name as string | null) ?? null,
      filePath: (r.file_path as string | null) ?? null,
      fileSize: (r.file_size as number | null) ?? null,
      filePages: (r.file_pages as number | null) ?? null,
      mimeType: (r.mime_type as string | null) ?? null,
      thumbUrl: (r.thumb_url as string | null) ?? null,
      views: Number(r.views ?? 0),
      downloads: Number(r.downloads ?? 0),
      createdAt: new Date(String(r.created_at)).toISOString(),
      author: toAuthor({
        id: String(r.author_id),
        fullName: String(r.full_name),
        branch: String(r.au_branch),
        semester: Number(r.au_semester),
        avatarUrl: (r.avatar_url as string | null) ?? null,
        rollNumber: String(r.roll_number),
        role: String(r.au_role || "user"),
      }),
      tags: tagMap.get(id) ?? [],
      likeCount: likeMap.get(id) ?? 0,
      commentCount: commentMap.get(id) ?? 0,
      saveCount: saveMap.get(id) ?? 0,
      liked: likedSet.has(id),
      saved: savedSet.has(id),
      viewerIsAuthor: viewerId === String(r.author_id),
      topComment: topMap.get(id) ?? null,
      fulfilledBy:
        r.fu_name != null
          ? toAuthor({
              id: String(r.fulfilled_by),
              fullName: String(r.fu_name),
              branch: String(r.fu_branch),
              semester: Number(r.fu_semester),
              avatarUrl: (r.fu_avatar as string | null) ?? null,
              rollNumber: String(r.fu_roll),
              role: String(r.fu_role || "user"),
            })
          : null,
      fulfilledPostId: (r.fulfilled_post_id as string | null) ?? null,
    };
  });
}
