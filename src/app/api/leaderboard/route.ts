import { handler, ok, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { leaderboard, rankOf, type LeaderboardRange } from "@/lib/activity";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return handler(async () => {
    const url = new URL(req.url);
    const range = (url.searchParams.get("range") ?? "overall") as LeaderboardRange;
    if (!["overall", "month", "week"].includes(range))
      return fail(400, "Unknown range.");
    const user = await getSessionUser();
    const [rows, mine] = await Promise.all([
      leaderboard(range, 25),
      user ? rankOf(user.id) : Promise.resolve(null),
    ]);
    return ok({ range, items: rows, mine });
  });
}
