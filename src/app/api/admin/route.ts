import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, posts, likes, comments, reports, notifications } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { cleanText, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Single admin surface. Every action re-checks the caller's role server-side,
 * so a normal user poking at these endpoints gets a 403 regardless of the UI.
 */
export async function GET() {
  return handler(async () => {
    await requireAdmin();
    const [usersCount, activeUsers, resources, requests, fulfilled, likeCount, commentCount, reportCount] =
      await Promise.all([
        db.execute(sql`select count(*)::int as n from users`),
        db.execute(sql`select count(*)::int as n from users where status = 'active'`),
        db.execute(sql`select count(*)::int as n from posts where kind = 'resource'`),
        db.execute(sql`select count(*)::int as n from posts where kind = 'request'`),
        db.execute(sql`select count(*)::int as n from posts where kind = 'request' and status = 'fulfilled'`),
        db.execute(sql`select count(*)::int as n from likes`),
        db.execute(sql`select count(*)::int as n from comments`),
        db.execute(sql`select count(*)::int as n from reports where status = 'open'`),
      ]);
    const num = (r: { rows: unknown[] }) =>
      Number((r.rows[0] as { n: number } | undefined)?.n ?? 0);

    const recentUsers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        rollNumber: users.rollNumber,
        branch: users.branch,
        semester: users.semester,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
        posts: sql<number>`(select count(*)::int from posts p where p.author_id = ${users.id})`,
        likes: sql<number>`(select count(*)::int from likes l join posts p on p.id = l.post_id where p.author_id = ${users.id})`,
      })
      .from(users)
      .orderBy(sql`users.created_at desc`)
      .limit(50);

    return ok({
      stats: {
        totalUsers: num(usersCount),
        activeUsers: num(activeUsers),
        totalResources: num(resources),
        totalRequests: num(requests),
        fulfilledRequests: num(fulfilled),
        totalLikes: num(likeCount),
        totalComments: num(commentCount),
        openReports: num(reportCount),
      },
      users: recentUsers.map((u) => ({
        ...u,
        posts: Number(u.posts),
        likes: Number(u.likes),
        createdAt: u.createdAt.toISOString(),
      })),
    });
  });
}

export async function PATCH(req: Request) {
  return handler(async () => {
    const admin = await requireAdmin();
    if (!rateLimit(`admin:${admin.id}`, 40, 60_000)) return fail(429, "Too many requests.");
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "user-status") {
      const targetId = String(body.userId ?? "");
      const status = body.status === "suspended" ? "suspended" : "active";
      const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!target) return fail(404, "User not found.");
      if (target.role === "admin") return fail(403, "Administrators cannot be suspended.");
      await db.update(users).set({ status }).where(eq(users.id, targetId));
      if (status === "suspended") {
        await db
          .update(notifications)
          .set({ read: true })
          .where(eq(notifications.userId, targetId));
      }
      return ok({ ok: true, status });
    }

    if (action === "user-delete") {
      const targetId = String(body.userId ?? "");
      const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
      if (!target) return fail(404, "User not found.");
      if (target.role === "admin") return fail(403, "Administrators cannot be deleted.");
      await db.delete(users).where(eq(users.id, targetId));
      return ok({ ok: true });
    }

    if (action === "remove-content") {
      const targetId = String(body.targetId ?? "");
      const kind = String(body.targetKind ?? "post");
      if (kind === "comment") {
        await db.delete(comments).where(eq(comments.id, targetId));
      } else {
        await db.delete(posts).where(eq(posts.id, targetId));
      }
      await db
        .update(reports)
        .set({ status: "resolved", resolverId: admin.id, resolvedAt: new Date() })
        .where(eq(reports.targetId, targetId));
      return ok({ ok: true });
    }

    if (action === "resolve-report") {
      const id = Number(body.reportId);
      if (!Number.isFinite(id)) return fail(400, "Report id required.");
      const status = body.status === "dismissed" ? "dismissed" : "resolved";
      await db
        .update(reports)
        .set({ status, resolverId: admin.id, resolvedAt: new Date() })
        .where(eq(reports.id, id));
      return ok({ ok: true, status });
    }

    return fail(400, "Unknown admin action.");
  });
}
