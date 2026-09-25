import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { reports, users, posts, comments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return handler(async () => {
    await requireAdmin();
    const rows = await db
      .select({
        id: reports.id,
        targetType: reports.targetType,
        targetId: reports.targetId,
        label: reports.label,
        reason: reports.reason,
        status: reports.status,
        createdAt: reports.createdAt,
        reporterName: users.fullName,
        reporterBranch: users.branch,
        reporterId: users.id,
      })
      .from(reports)
      .leftJoin(users, eq(users.id, reports.reporterId))
      .orderBy(desc(reports.createdAt))
      .limit(100);

    const postIds = rows.filter((r) => r.targetType !== "comment" && r.targetType !== "user").map((r) => r.targetId);
    const commentIds = rows.filter((r) => r.targetType === "comment").map((r) => r.targetId);

    const [postRows, commentRows, userRows] = await Promise.all([
      postIds.length
        ? db.select({ id: posts.id, title: posts.title }).from(posts).where(inArray(posts.id, postIds))
        : Promise.resolve([]),
      commentIds.length
        ? db.select({ id: comments.id, body: comments.body }).from(comments).where(inArray(comments.id, commentIds))
        : Promise.resolve([]),
      db.select({ id: users.id, fullName: users.fullName }).from(users),
    ]);

    const labelFor = (r: (typeof rows)[number]) => {
      if (r.label) return r.label;
      if (r.targetType === "comment")
        return commentRows.find((c) => c.id === r.targetId)?.body.slice(0, 90) ?? "(deleted comment)";
      if (r.targetType === "user")
        return userRows.find((u) => u.id === r.targetId)?.fullName ?? "(deleted user)";
      return (
        postRows.find((p) => p.id === r.targetId)?.title ??
        "(deleted resource)"
      );
    };

    return ok({
      items: rows.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        label: labelFor(r),
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        reporter: r.reporterId
          ? { id: r.reporterId, fullName: r.reporterName, branch: r.reporterBranch }
          : null,
        stillExists:
          r.targetType === "comment"
            ? commentRows.some((c) => c.id === r.targetId)
            : r.targetType === "user"
              ? userRows.some((u) => u.id === r.targetId)
              : postRows.some((p) => p.id === r.targetId),
      })),
    });
  });
}
