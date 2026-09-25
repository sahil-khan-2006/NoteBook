"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Flame, UserPlus, Filter } from "lucide-react";
import { FeedList } from "@/components/FeedList";
import { Avatar, Button, Modal, EmptyState, useToast } from "@/components/ui";
import { api, semLabel } from "@/lib/client";
import { BRANCHES, SEMESTERS, RESOURCE_TYPES } from "@/lib/constants";

type ExploreData = {
  people: {
    id: string;
    fullName: string;
    branch: string;
    semester: number;
    avatarUrl: string | null;
    rollNumber: string;
    followers: number;
    posts: number;
  }[];
  subjects: { id: number; name: string; posts: number }[];
  tags: { name: string; count: number }[];
  trending: { id: string; title: string; resourceType: string | null }[];
};

const SELECT =
  "rounded-lg border border-line bg-card px-3 py-2 text-[13px] text-ink focus:border-blue focus:outline-none";

function ExploreInner() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [branch, setBranch] = useState(params.get("branch") ?? "");
  const [semester, setSemester] = useState(params.get("semester") ?? "");
  const [type, setType] = useState(params.get("type") ?? "");
  const [subject, setSubject] = useState(params.get("subject") ?? params.get("tag") ?? "");
  const [kind, setKind] = useState<"resource" | "request">("resource");
  const [data, setData] = useState<ExploreData>({ people: [], subjects: [], tags: [], trending: [] });
  const [showFilters, setShowFilters] = useState(false);
  const [followed, setFollowed] = useState<Record<string, boolean>>({});

  const sp = new URLSearchParams();
  if (q) sp.set("q", q);
  if (branch) sp.set("branch", branch);
  if (semester) sp.set("semester", semester);
  if (type) sp.set("type", type);
  if (subject) sp.set("subject", subject);
  const query = sp.toString();

  useEffect(() => {
    const t = setTimeout(() => {
      api<ExploreData>(`/api/explore${query ? `?${query}` : ""}`)
        .then(setData)
        .catch(() => toast("Could not load explore.", "error"));
    }, 220);
    return () => clearTimeout(t);
  }, [query, toast]);

  const update = (k: string, v: string, setter: (s: string) => void) => {
    setter(v);
    const next = new URLSearchParams(sp);
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(`/explore?${next.toString()}`, { scroll: false });
  };

  const toggleFollow = async (id: string) => {
    setFollowed((f) => ({ ...f, [id]: !f[id] }));
    try {
      const r = await api<{ following: boolean }>(`/api/users/${id}/follow`, { method: "POST" });
      setFollowed((f) => ({ ...f, [id]: r.following }));
      toast(r.following ? "Following." : "Unfollowed.");
    } catch (e) {
      setFollowed((f) => ({ ...f, [id]: !f[id] }));
      toast((e as Error).message, "error");
    }
  };

  const activeFilters = [branch, semester, type, subject].filter(Boolean).length;

  return (
    <div className="space-y-5 px-4 lg:px-0">
      <div className="card p-4">
        <h1 className="font-display text-xl font-bold text-ink">Explore</h1>
        <p className="mt-0.5 text-[13px] text-slate">
          Search notes, PYQs, subjects, tags and students across the college.
        </p>

        <div className="mt-3 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-paper px-3">
            <Search size={16} className="text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder='Try "DSA", "DBMS PYQ", "Operating Systems"…'
              aria-label="Search resources"
              className="w-full bg-transparent py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search" className="text-muted hover:text-flame">
                <X size={15} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="relative grid w-11 place-items-center rounded-xl border border-line text-slate hover:border-blue hover:text-blue"
            aria-label="Toggle filters"
          >
            <Filter size={17} />
            {activeFilters > 0 && (
              <span className="num absolute -right-1.5 -top-1.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-blue px-1 text-[10px] font-bold text-white">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="mt-3 grid gap-2 border-t border-line pt-3 sm:grid-cols-4">
            <select aria-label="Branch" className={SELECT} value={branch} onChange={(e) => update("branch", e.target.value, setBranch)}>
              <option value="">All branches</option>
              {BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
            <select aria-label="Semester" className={SELECT} value={semester} onChange={(e) => update("semester", e.target.value, setSemester)}>
              <option value="">All semesters</option>
              {SEMESTERS.map((s) => <option key={s} value={s}>{s} semester</option>)}
            </select>
            <select aria-label="Resource type" className={SELECT} value={type} onChange={(e) => update("type", e.target.value, setType)}>
              <option value="">All types</option>
              {RESOURCE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input
              aria-label="Subject"
              placeholder="Subject"
              className={SELECT}
              value={subject}
              onChange={(e) => update("subject", e.target.value, setSubject)}
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(q || branch || semester || type || subject) && (
            <button
              onClick={() => {
                setQ(""); setBranch(""); setSemester(""); setType(""); setSubject("");
                router.replace("/explore");
              }}
              className="rounded-lg bg-flamewash px-2.5 py-1.5 text-[12px] font-medium text-flame"
            >
              Clear all
            </button>
          )}
          {data.tags.slice(0, 8).map((t) => (
            <button
              key={t.name}
              onClick={() => update("subject", t.name, setSubject)}
              className="rounded-lg bg-wash px-2.5 py-1.5 text-[12px] font-medium text-blue hover:bg-blue hover:text-white"
            >
              #{t.name} <span className="num opacity-70">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* trending */}
      {!q && data.trending.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-1.5">
            <Flame size={14} className="text-flame" />
            <span className="tblock">🔥 Trending resources</span>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto no-bar pb-1">
            {data.trending.map((t) => (
              <Link
                key={t.id}
                href={`/resource/${t.id}`}
                className="flex min-w-[190px] flex-col rounded-xl border border-line bg-paper p-3 transition-colors hover:border-blue"
              >
                <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">
                  {t.title}
                </span>
                <span className="tblock mt-2">{t.resourceType ?? "Resource"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* people */}
      {data.people.length > 0 && (
        <div className="card p-4">
          <span className="tblock">Students{q ? ` matching “${q}”` : ""}</span>
          <ul className="mt-3 space-y-2.5">
            {data.people.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Avatar name={p.fullName} src={p.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <Link href={`/profile/${p.id}`} className="block truncate text-[14px] font-semibold text-ink hover:text-blue">
                    {p.fullName}
                  </Link>
                  <p className="truncate text-[12px] text-slate">
                    {p.branch} • {semLabel(p.semester)} · <span className="num">{p.followers}</span> followers
                  </p>
                </div>
                <Button variant="outline" className="!py-1.5 !text-[12.5px]" onClick={() => toggleFollow(p.id)}>
                  <UserPlus size={14} /> {followed[p.id] ? "Following" : "Follow"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* subjects */}
      {data.subjects.length > 0 && (
        <div className="card p-4">
          <span className="tblock">Subjects</span>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => update("subject", s.name, setSubject)}
                className={`rounded-xl border px-3 py-2 text-[13px] font-medium transition-colors ${
                  subject === s.name
                    ? "border-blue bg-blue text-white"
                    : "border-line text-slate hover:border-blue hover:text-blue"
                }`}
              >
                {s.name} <span className="num opacity-70">{s.posts}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* result tabs */}
      <div className="flex gap-1 rounded-xl border border-line bg-card p-1.5">
        {(["resource", "request"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
              kind === k ? "bg-blue text-white" : "text-slate hover:text-ink"
            }`}
          >
            {k === "resource" ? "Resources" : "Requests"}
          </button>
        ))}
      </div>

      <FeedList
        query={`/api/posts?kind=${kind}${query ? `&${query}` : ""}`}
        key={`${kind}-${query}`}
        empty={
          <EmptyState
            icon={<span className="text-2xl">🔎</span>}
            title="No matches"
            body="Nothing matched that search. Try a subject code, a tag like #DSA, or clear your filters."
          />
        }
      />
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 px-4 lg:px-0">
          <div className="skeleton h-32 rounded-xl" />
          <div className="skeleton h-64 rounded-xl" />
        </div>
      }
    >
      <ExploreInner />
    </Suspense>
  );
}
