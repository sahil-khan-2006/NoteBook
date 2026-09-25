import { and, asc, desc, eq, gte, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import { notifications, posts, users, streaks, likes, comments } from "@/db/schema";

export type NotifyType =
  | "like"
  | "comment"
  | "reply"
  | "follow"
  | "fulfill"
  | "request_interact"
  | "new_resource";

export async function notify(input: {
  userId: string;
  actorId?: string | null;
  type: NotifyType;
  postId?: string | null;
  body: string;
}) {
  if (input.actorId && input.actorId === input.userId) return;
  await db.insert(notifications).values({
    userId: input.userId,
    actorId: input.actorId ?? null,
    type: input.type,
    postId: input.postId ?? null,
    body: input.body.slice(0, 280),
  });
}

/** Notify everyone who follows `authorId` that a new resource went out. */
export async function notifyFollowersOfNewResource(authorId: string, postId: string) {
  const followers = await db.execute(sql`
    select follower_id from follows where following_id = ${authorId}
  `);
  const ids = followers.rows.map((r) => (r as { follower_id: string }).follower_id);
  if (!ids.length) return;
  await db.insert(notifications).values(
    ids.map((id) => ({
      userId: id,
      actorId: authorId,
      type: "new_resource" as const,
      postId,
      body: "published a new resource",
    })),
  );
}

export const istDay = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

const dayOffset = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return istDay(d);
};

/**
 * Advances the daily posting streak. Called once per calendar day per user —
 * multiple posts on the same day never inflate the counter.
 */
export async function bumpStreak(userId: string) {
  const today = istDay();
  const [row] = await db.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);

  if (!row) {
    await db.insert(streaks).values({
      userId,
      current: 1,
      highest: 1,
      lastPostDate: today,
    });
    return { current: 1, highest: 1 };
  }
  if (row.lastPostDate === today) return { current: row.current, highest: row.highest };

  const yesterday = dayOffset(1);
  const current = row.lastPostDate === yesterday ? row.current + 1 : 1;
  const highest = Math.max(row.highest, current);
  await db
    .update(streaks)
    .set({ current, highest, lastPostDate: today, updatedAt: new Date() })
    .where(eq(streaks.userId, userId));
  return { current, highest };
}

export async function getStreak(userId: string) {
  const [row] = await db.select().from(streaks).where(eq(streaks.userId, userId)).limit(1);
  const today = istDay();
  const yesterday = dayOffset(1);
  const raw = row?.current ?? 0;
  const active = row?.lastPostDate === today || row?.lastPostDate === yesterday;
  const postDays = await db
    .select({ day: sql<string>`to_char(created_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD')` })
    .from(posts)
    .where(
      and(
        eq(posts.authorId, userId),
        gte(posts.createdAt, sql`now() - interval '7 days'`),
      ),
    );
  const daySet = new Set(postDays.map((r) => r.day));
  const calendar = Array.from({ length: 7 }, (_, i) => {
    const date = dayOffset(6 - i);
    return { date, posted: daySet.has(date) };
  });
  return {
    current: active ? raw : 0,
    highest: row?.highest ?? 0,
    lastPostDate: row?.lastPostDate ?? null,
    postedToday: daySet.has(today),
    calendar,
  };
}

/* ------------------------------- leaderboard ------------------------------ */

export type LeaderboardRange = "overall" | "month" | "week";

const rangeStart = (range: LeaderboardRange) =>
  range === "week"
    ? sql`now() - interval '7 days'`
    : range === "month"
      ? sql`now() - interval '30 days'`
      : sql`'1970-01-01'::timestamptz`;

export async function leaderboard(range: LeaderboardRange, limit = 25) {
  const start = rangeStart(range);
  const rows = await db.execute(sql`
    select u.id, u.full_name, u.branch, u.semester, u.avatar_url, u.roll_number,
      count(distinct p.id)::int as post_count,
      count(l.created_at)::int as total_likes
    from users u
    join posts p on p.author_id = u.id and p.created_at >= ${start}
    left join likes l on l.post_id = p.id and l.created_at >= ${start}
    where u.status = 'active'
    group by u.id
    order by total_likes desc, post_count desc, u.full_name asc
    limit ${limit}
  `);
  return (rows.rows as Record<string, unknown>[]).map((r, i) => ({
    rank: i + 1,
    id: String(r.id),
    fullName: String(r.full_name),
    branch: String(r.branch),
    semester: Number(r.semester),
    avatarUrl: (r.avatar_url as string | null) ?? null,
    rollNumber: String(r.roll_number),
    posts: Number(r.post_count),
    totalLikes: Number(r.total_likes),
  }));
}

export async function rankOf(userId: string) {
  const overall = await leaderboard("overall", 500);
  const found = overall.find((r) => r.id === userId);
  return found ? { rank: found.rank, totalLikes: found.totalLikes, posts: found.posts } : null;
}

export async function unreadCount(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return Number(row?.n ?? 0);
}

export async function profileStats(userId: string) {
  const [postCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.authorId, userId));
  const likeAgg = await db.execute(sql`
    select coalesce(sum(c), 0)::int as n from (
      select count(*)::int as c from likes l
      join posts p on p.id = l.post_id
      where p.author_id = ${userId}
      group by l.post_id
    ) t
  `);
  const f1 = await db.execute(
    sql`select count(*)::int as n from follows where following_id = ${userId}`,
  );
  const f2 = await db.execute(
    sql`select count(*)::int as n from follows where follower_id = ${userId}`,
  );
  return {
    posts: Number(postCount?.n ?? 0),
    totalLikes: Number((likeAgg.rows[0] as { n: number } | undefined)?.n ?? 0),
    followers: Number((f1.rows[0] as { n: number } | undefined)?.n ?? 0),
    following: Number((f2.rows[0] as { n: number } | undefined)?.n ?? 0),
  };
}
