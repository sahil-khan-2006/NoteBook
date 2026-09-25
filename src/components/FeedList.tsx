"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PostDto } from "@/lib/feed";
import { api } from "@/lib/client";
import { PostCard } from "@/components/PostCard";
import { PostSkeleton, EmptyState } from "@/components/ui";

export type FeedResponse = {
  items: PostDto[];
  nextOffset: number | null;
  total: number;
};

export function FeedList({
  query,
  empty,
  pageSize = 8,
  header,
}: {
  query: string;
  empty?: React.ReactNode;
  pageSize?: number;
  header?: React.ReactNode;
}) {
  const [items, setItems] = useState<PostDto[]>([]);
  const [next, setNext] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const inflight = useRef(false);

  const load = useCallback(
    async (offset: number) => {
      if (inflight.current) return;
      inflight.current = true;
      setError(null);
      try {
        const sep = query.includes("?") ? "&" : "?";
        const res = await api<FeedResponse>(
          `${query}${sep}offset=${offset}&limit=${pageSize}`,
        );
        setItems((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          const fresh = res.items.filter((p) => !seen.has(p.id));
          return offset === 0 ? res.items : [...prev, ...fresh];
        });
        setNext(res.nextOffset);
        setTotal(res.total);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
        inflight.current = false;
      }
    },
    [query, pageSize],
  );

  useEffect(() => {
    setItems([]);
    setNext(0);
    setLoading(true);
    load(0);
  }, [load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || next === null) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) load(next);
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [next, load]);

  const patch = (id: string, p: Partial<PostDto>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));

  return (
    <div className="space-y-4">
      {header}
      {loading && !items.length && (
        <>
          <PostSkeleton />
          <PostSkeleton />
        </>
      )}

      {error && !items.length && (
        <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-sm text-slate">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              load(0);
            }}
            className="rounded-xl bg-blue px-4 py-2 text-sm font-semibold text-white"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !items.length && !error && (empty ?? (
        <EmptyState
          icon={<span className="text-2xl">📚</span>}
          title="Nothing here yet"
          body="Be the first to publish a resource for this view — notes, PYQs or a lab manual."
        />
      ))}

      {items.map((p, i) => (
        <div key={p.id} style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
          <PostCard post={p} onChange={patch} />
        </div>
      ))}

      {loading && items.length > 0 && <PostSkeleton />}

      {error && items.length > 0 && (
        <button
          onClick={() => load(next ?? items.length)}
          className="w-full rounded-xl border border-line bg-card py-3 text-sm font-semibold text-blue"
        >
          Couldn’t load more — tap to retry
        </button>
      )}

      <div ref={sentinel} className="h-1" />

      {next === null && items.length > 0 && (
        <p className="tblock py-4 text-center">
          End of the list — {total} result{total === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
