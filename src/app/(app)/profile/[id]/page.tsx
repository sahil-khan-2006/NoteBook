"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  UserMinus,
  Pencil,
  Flame,
  Trophy,
  Link2,
  Heart,
} from "lucide-react";
import { FeedList } from "@/components/FeedList";
import { Avatar, Button, Modal, EmptyState, useToast } from "@/components/ui";
import { useApp } from "@/components/Shell";
import { api, semLabel, timeAgo } from "@/lib/client";
import { BRANCHES, SEMESTERS } from "@/lib/constants";

type Profile = {
  user: {
    id: string;
    fullName: string;
    branch: string;
    semester: number;
    admissionYear: number;
    rollNumber: string;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: string;
    role: string;
  };
  stats: { posts: number; totalLikes: number; followers: number; following: number };
  streak: {
    current: number;
    highest: number;
    postedToday: boolean;
    calendar: { date: string; posted: boolean }[];
  };
  rank: { rank: number; totalLikes: number; posts: number } | null;
  subjects: string[];
  isFollowing: boolean;
  isSelf: boolean;
};

const TABS = ["Posts", "Requests"] as const;
const WD = ["M", "T", "W", "T", "F", "S", "S"];

export default function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { me } = useApp();
  const toast = useToast();
  const [id, setId] = useState<string>("");
  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Posts");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api<Profile>(`/api/users/${id}`)
      .then(setData)
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [id, toast]);

  const toggleFollow = async () => {
    if (!data) return;
    const prev = data.isFollowing;
    setData({ ...data, isFollowing: !prev, stats: {
      ...data.stats,
      followers: data.stats.followers + (prev ? -1 : 1),
    }});
    try {
      const r = await api<{ following: boolean; followers: number }>(
        `/api/users/${id}/follow`,
        { method: "POST" },
      );
      setData((d) =>
        d ? { ...d, isFollowing: r.following, stats: { ...d.stats, followers: r.followers } } : d,
      );
      toast(r.following ? "Following." : "Unfollowed.");
    } catch (e) {
      setData((d) => (d ? { ...d, isFollowing: prev } : d));
      toast((e as Error).message, "error");
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-4 px-4 lg:px-0">
        <div className="card p-5">
          <div className="flex gap-4">
            <div className="skeleton h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-3">
              <div className="skeleton h-5 w-48 rounded" />
              <div className="skeleton h-3 w-32 rounded" />
              <div className="skeleton h-3 w-64 rounded" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { user, stats, streak, rank, subjects, isFollowing, isSelf } = data;

  return (
    <div className="space-y-4 px-4 lg:px-0">
      {/* ── identity card ── */}
      <section className="card overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-blue via-bluepress to-rail" />
        <div className="-mt-10 px-5 pb-5">
          <div className="flex flex-wrap items-end gap-4">
            <div className="rounded-full border-4 border-card">
              <Avatar name={user.fullName} src={user.avatarUrl} size={84} />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="font-display text-xl font-extrabold leading-tight text-ink">
                {user.fullName}
              </h1>
              <p className="text-[13.5px] text-slate">
                {user.branch} • {semLabel(user.semester)}
              </p>
              <p className="tblock mt-0.5">
                {user.rollNumber} · Batch {user.admissionYear}
              </p>
            </div>
            <div className="flex gap-2 pb-1">
              {isSelf ? (
                <>
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil size={15} /> Edit Profile
                  </Button>
                  {me?.role === "admin" && (
                    <Link href="/admin">
                      <Button variant="danger">Admin</Button>
                    </Link>
                  )}
                </>
              ) : (
                <Button
                  variant={isFollowing ? "outline" : "primary"}
                  onClick={toggleFollow}
                  aria-pressed={isFollowing}
                >
                  {isFollowing ? <UserMinus size={15} /> : <UserPlus size={15} />}
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              )}
            </div>
          </div>

          {user.bio && <p className="mt-3 text-[14px] leading-relaxed text-slate">{user.bio}</p>}

          <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-xl border border-line sm:grid-cols-4">
            {[
              ["Posts", stats.posts],
              ["Followers", stats.followers],
              ["Following", stats.following],
              ["Total Likes", stats.totalLikes],
            ].map(([label, value], i) => (
              <div
                key={label as string}
                className={`px-3 py-3 text-center ${i === 3 ? "hidden sm:block" : ""}`}
              >
                <dd className="num text-xl font-semibold text-ink">{value}</dd>
                <dt className="tblock mt-0.5">{label}</dt>
              </div>
            ))}
          </dl>

          {subjects.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {subjects.map((s) => (
                <span key={s} className="rounded-md bg-wash px-2 py-1 text-[12px] font-medium text-blue">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── streak + rank: the record-book spread ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card relative overflow-hidden p-5">
          <span
            aria-hidden
            className="num pointer-events-none absolute -right-3 -top-5 select-none text-[92px] font-bold leading-none text-flame/10"
          >
            {streak.current}
          </span>
          <div className="flex items-center gap-2">
            <Flame size={15} className="text-flame" />
            <span className="tblock">Daily posting streak</span>
          </div>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="num text-[44px] font-bold leading-none text-ink">
              {streak.current}
            </span>
            <span className="text-[15px] font-medium text-slate">
              day streak {streak.current > 0 ? "🔥" : ""}
            </span>
          </p>
          <p className="mt-1 text-[13px] text-slate">
            {streak.postedToday ? (
              <span className="font-semibold text-flame">You posted today ✓</span>
            ) : streak.current > 0 ? (
              "Post today to keep the run going."
            ) : (
              "Publish any resource or request to start."
            )}
          </p>

          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {streak.calendar.map((d, i) => (
              <div key={d.date} className="text-center">
                <span className="tblock">{WD[i]}</span>
                <span
                  className={`mt-1 grid aspect-square place-items-center rounded-lg text-[13px] ${
                    d.posted
                      ? "stamped bg-flame text-white"
                      : "border border-dashed border-line bg-paper text-muted"
                  }`}
                  style={d.posted ? { animationDelay: `${i * 55}ms` } : undefined}
                  title={d.date}
                >
                  {d.posted ? "✓" : "·"}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-slate">
            Highest streak:{" "}
            <span className="num font-semibold text-ink">{streak.highest}</span> days
          </p>
        </section>

        <section className="card relative overflow-hidden p-5">
          <span
            aria-hidden
            className="num pointer-events-none absolute -right-3 -top-5 select-none text-[92px] font-bold leading-none text-blue/10"
          >
            {rank?.rank ?? "—"}
          </span>
          <div className="flex items-center gap-2">
            <Trophy size={15} className="text-blue" />
            <span className="tblock">Leaderboard position</span>
          </div>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="num text-[44px] font-bold leading-none text-blue">
              #{rank?.rank ?? "—"}
            </span>
          </p>
          <p className="mt-1 text-[13px] text-slate">
            Ranked on{" "}
            <span className="num font-semibold text-ink">
              {rank?.totalLikes ?? stats.totalLikes}
            </span>{" "}
            total likes across{" "}
            <span className="num font-semibold text-ink">{rank?.posts ?? stats.posts}</span>{" "}
            posts.
          </p>

          <div className="mt-4 space-y-2.5 border-t border-line pt-4">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-slate">Likes received</span>
              <span className="num font-semibold text-ink">{stats.totalLikes}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-paper">
              <div
                className="h-full rounded-full bg-blue transition-all"
                style={{
                  width: `${Math.min(100, Math.max(6, ((rank?.totalLikes ?? 0) / Math.max(1, stats.totalLikes || 1)) * 100))}%`,
                }}
              />
            </div>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-blue hover:underline"
            >
              <Link2 size={14} /> Open the full leaderboard
            </Link>
          </div>
        </section>
      </div>

      {/* ── tabs ── */}
      <div className="flex gap-1 rounded-xl border border-line bg-card p-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex-1 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-all ${
              tab === t ? "bg-blue text-white" : "text-slate hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
        {isSelf && (
          <Link
            href="/saved"
            className="flex-1 rounded-lg px-3 py-2 text-center text-[13.5px] font-semibold text-slate transition-colors hover:bg-wash"
          >
            Saved
          </Link>
        )}
      </div>

      <FeedList
        query={
          tab === "Posts"
            ? `/api/posts?author=${user.id}`
            : `/api/posts?author=${user.id}&kind=request`
        }
        key={`${user.id}-${tab}`}
        empty={
          <EmptyState
            icon={tab === "Posts" ? <Heart size={26} /> : <span className="text-2xl">🙋</span>}
            title={tab === "Posts" ? "No resources yet" : "No requests yet"}
            body={
              tab === "Posts"
                ? `${user.fullName.split(" ")[0]} hasn’t published a resource. ${
                    isSelf ? "Your first upload starts your streak." : "Follow to catch the first one."
                  }`
                : "Requests appear here when they ask the network for material."
            }
          />
        }
      />

      <p className="pb-4 text-center tblock">
        Joined {timeAgo(user.createdAt)} · B.P. Mandal College of Engineering
      </p>

      {editing && (
        <EditProfile
          data={data}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setData({ ...data, ...next });
            setEditing(false);
            toast("Profile updated.");
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------ edit profile ----------------------------- */

function EditProfile({
  data,
  onClose,
  onSaved,
}: {
  data: Profile;
  onClose: () => void;
  onSaved: (p: Partial<Profile>) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: data.user.fullName,
    bio: data.user.bio ?? "",
    branch: data.user.branch,
    semester: data.user.semester,
    currentPassword: "",
    newPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/me", {
        method: "PATCH",
        json: {
          fullName: form.fullName,
          bio: form.bio,
          branch: form.branch,
          semester: form.semester,
          ...(form.newPassword
            ? {
                currentPassword: form.currentPassword,
                newPassword: form.newPassword,
              }
            : {}),
        },
      });
      onSaved({
        user: { ...data.user, fullName: form.fullName, bio: form.bio, branch: form.branch, semester: form.semester },
      });
    } catch (err) {
      setError((err as Error).message);
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const INPUT =
    "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink focus:border-blue focus:outline-none";
  const LABEL = "block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted";

  return (
    <Modal open onClose={onClose} title="Edit profile">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={LABEL} htmlFor="e-name">Full name</label>
          <input id="e-name" className={`${INPUT} mt-1.5`} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div>
          <label className={LABEL} htmlFor="e-bio">Bio</label>
          <textarea id="e-bio" className={`${INPUT} mt-1.5 min-h-[76px] resize-y`} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={240} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL} htmlFor="e-branch">Branch</label>
            <select id="e-branch" className={`${INPUT} mt-1.5`} value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
              {BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="e-sem">Semester</label>
            <select id="e-sem" className={`${INPUT} mt-1.5`} value={form.semester} onChange={(e) => setForm({ ...form, semester: Number(e.target.value) })}>
              {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <p className="tblock">Change password</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="e-cur">Current</label>
              <input id="e-cur" type="password" className={`${INPUT} mt-1.5`} value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} autoComplete="current-password" />
            </div>
            <div>
              <label className={LABEL} htmlFor="e-new">New</label>
              <input id="e-new" type="password" className={`${INPUT} mt-1.5`} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} autoComplete="new-password" />
            </div>
          </div>
        </div>

        {error && <p className="rounded-lg bg-flamewash px-3.5 py-2.5 text-[13px] text-flame">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={busy}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}
