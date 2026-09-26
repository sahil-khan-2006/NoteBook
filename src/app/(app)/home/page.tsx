"use client";

import { useState } from "react";
import Link from "next/link";
import { PenLine, Flame } from "lucide-react";
import { FeedList } from "@/components/FeedList";
import { useApp } from "@/components/Shell";
import { Avatar, EmptyState } from "@/components/ui";
import { semLabel } from "@/lib/client";

const TABS = [
  { id: "for-you", label: "For You" },
  { id: "following", label: "Following" },
] as const;

export default function HomePage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("for-you");
  const { me, streak, openCreate } = useApp();

  return (
    <div className="space-y-4 px-4 lg:px-0">
      {/* segmented tabs */}
      <div className="flex gap-1 rounded-xl border border-line bg-card p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`flex-1 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-all ${
              tab === t.id ? "bg-blue text-white shadow-sm" : "text-slate hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* streak banner */}
      <div className="flex items-center gap-3 rounded-xl border border-flame/30 bg-flamewash px-4 py-3">
        <span className="text-xl">🔥</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink">
            <span className="num">{streak.current}</span> Day Streak
            {streak.postedToday && (
              <span className="ml-2 font-medium text-flame">You posted today ✓</span>
            )}
          </p>
          <p className="truncate text-[12px] text-slate">
            Best run: <span className="num">{streak.highest}</span> days · only
            resource & request posts count.
          </p>
        </div>
        <Link href="/profile" className="tblock shrink-0 text-blue">
          View
        </Link>
      </div>

      {/* composer */}
      <div className="flex items-center gap-3 card px-4 py-3">
        <Avatar name={me?.fullName ?? "…"} src={me?.avatarUrl} size={40} />
        <button
          onClick={() => openCreate("resource")}
          className="flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-left text-[13.5px] text-muted transition-colors hover:border-blue"
        >
          Share a resource, ask for something…
        </button>
        <button
          onClick={() => openCreate("resource")}
          aria-label="Create post"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue text-white transition-transform hover:scale-105"
        >
          <PenLine size={17} />
        </button>
      </div>

      <div className="flex items-center justify-between px-1">
        <h1 className="font-display text-lg font-bold text-ink">
          {tab === "for-you" ? "For You" : "Following"}
        </h1>
        <span className="tblock">
          {me
            ? me.role === "professor"
              ? `${me.branch} • Faculty`
              : `${me.branch} • ${semLabel(me.semester)}`
            : "NoteBook"}
        </span>
      </div>

      <FeedList
        query={`/api/posts?tab=${tab}`}
        key={tab}
        empty={
          tab === "following" ? (
            <EmptyState
              icon={<span className="text-2xl">👥</span>}
              title="Your following feed is quiet"
              body="Follow contributors whose notes helped you — their next resource lands right here."
              action={
                <Link
                  href="/explore"
                  className="rounded-xl bg-blue px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Find students
                </Link>
              }
            />
          ) : undefined
        }
      />

      <div className="flex items-center justify-center gap-2 py-6 text-muted">
        <Flame size={14} className="text-flame" />
        <span className="tblock">Learn · Share · Grow</span>
      </div>
    </div>
  );
}
