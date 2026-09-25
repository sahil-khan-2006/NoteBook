"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Medal } from "lucide-react";
import { Avatar, EmptyState } from "@/components/ui";
import { api, fmtCount, semLabel } from "@/lib/client";
import { useApp } from "@/components/Shell";

type Row = {
  rank: number;
  id: string;
  fullName: string;
  branch: string;
  semester: number;
  avatarUrl: string | null;
  rollNumber: string;
  posts: number;
  totalLikes: number;
};

const RANGES = [
  { id: "overall", label: "Overall" },
  { id: "month", label: "This Month" },
  { id: "week", label: "This Week" },
] as const;

export default function LeaderboardPage() {
  const { me } = useApp();
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("overall");
  const [items, setItems] = useState<Row[]>([]);
  const [mine, setMine] = useState<{ rank: number; totalLikes: number; posts: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<{ items: Row[]; mine: typeof mine }>(`/api/leaderboard?range=${range}`)
      .then((d) => {
        setItems(d.items);
        setMine(d.mine);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [range]);

  const podium = items.slice(0, 3);
  const rest = items.slice(3);

  return (
    <div className="space-y-4 px-4 lg:px-0">
      <div className="card overflow-hidden">
        <div className="border-b border-line bg-rail px-5 py-5">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-flame" />
            <span className="tblock text-railink/60">🏆 Academic contributors</span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-extrabold leading-tight text-railink">
            Ranked by total likes
            <br />
            received across every post.
          </h1>
          <p className="mt-2 max-w-md text-[13px] leading-relaxed text-railink/60">
            Not followers. Not volume. The community voting with ❤️ on the material
            that actually helped them.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1.5 border-b border-line bg-card p-2">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              aria-pressed={range === r.id}
              className={`rounded-lg px-2 py-2 text-[13px] font-semibold transition-all ${
                range === r.id ? "bg-blue text-white" : "text-slate hover:bg-wash"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {mine && (
          <div className="flex items-center gap-3 border-b border-line bg-wash px-5 py-3">
            <span className="tblock">Your position</span>
            <span className="num ml-auto text-xl font-semibold text-blue">
              #{mine.rank}
            </span>
            <span className="num text-[13px] text-slate">
              {fmtCount(mine.totalLikes)} likes · {mine.posts} posts
            </span>
          </div>
        )}

        {/* podium */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-4 pt-5">
          {loading && [0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-40 rounded-xl" />
          ))}
          {!loading &&
            [podium[1], podium[0], podium[2]].map((u, i) => {
              if (!u) return <div key={i} />;
              const isFirst = u.rank === 1;
              return (
                <Link
                  key={u.id}
                  href={`/profile/${u.id}`}
                  className={`card flex flex-col items-center px-2 py-4 text-center transition-transform hover:-translate-y-1 ${
                    isFirst ? "border-blue shadow-lg shadow-blue/15" : ""
                  }`}
                >
                  <span className={`num text-lg font-bold ${isFirst ? "text-blue" : "text-muted"}`}>
                    {u.rank === 1 ? "🥇" : u.rank === 2 ? "🥈" : "🥉"}
                  </span>
                  <div className="mt-2">
                    <Avatar name={u.fullName} src={u.avatarUrl} size={isFirst ? 56 : 46} ring={isFirst} />
                  </div>
                  <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-ink">
                    {u.fullName}
                  </p>
                  <p className="tblock mt-0.5 truncate">{u.branch}</p>
                  <p className="num mt-2 text-xl font-bold text-blue">{fmtCount(u.totalLikes)}</p>
                  <p className="tblock">likes · {u.posts} posts</p>
                </Link>
              );
            })}
        </div>
      </div>

      {/* ladder */}
      <div className="card overflow-hidden">
        {loading && [0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line p-4">
            <div className="skeleton h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-40 rounded" />
              <div className="skeleton h-2.5 w-24 rounded" />
            </div>
          </div>
        ))}

        {!loading && items.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={<Medal size={26} />}
              title="No contributors yet"
              body="Publish a resource and collect your first likes to open the leaderboard."
            />
          </div>
        )}

        {!loading &&
          rest.map((u) => (
            <Link
              key={u.id}
              href={`/profile/${u.id}`}
              className="flex items-center gap-3 border-b border-line px-4 py-3.5 transition-colors last:border-0 hover:bg-wash"
            >
              <span className="num w-8 shrink-0 text-lg font-semibold text-muted">
                {u.rank}
              </span>
              <Avatar name={u.fullName} src={u.avatarUrl} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink">{u.fullName}</p>
                <p className="truncate text-[12px] text-slate">
                  {u.branch} • {semLabel(u.semester)} · <span className="num">{u.posts}</span>{" "}
                  posts
                </p>
              </div>
              <div className="text-right">
                <p className="num text-[15px] font-bold text-blue">{fmtCount(u.totalLikes)}</p>
                <p className="tblock">total likes</p>
              </div>
            </Link>
          ))}
      </div>

      {me && (
        <p className="pb-2 text-center text-[13px] text-slate">
          Want to climb?{" "}
          <Link href="/home" className="font-semibold text-blue hover:underline">
            Publish a resource
          </Link>
        </p>
      )}
    </div>
  );
}
