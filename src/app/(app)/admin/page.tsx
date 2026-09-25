"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  FileText,
  MessageSquare,
  Heart,
  Flag,
  CheckCircle2,
  ShieldAlert,
  Inbox,
} from "lucide-react";
import { Avatar, Button, EmptyState, useToast } from "@/components/ui";
import { useApp } from "@/components/Shell";
import { api, fmtCount, timeAgo } from "@/lib/client";

type Stats = {
  totalUsers: number;
  activeUsers: number;
  totalResources: number;
  totalRequests: number;
  fulfilledRequests: number;
  totalLikes: number;
  totalComments: number;
  openReports: number;
};

type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  rollNumber: string;
  branch: string;
  semester: number;
  role: string;
  status: string;
  createdAt: string;
  posts: number;
  likes: number;
};

type Report = {
  id: number;
  targetType: string;
  targetId: string;
  label: string | null;
  reason: string;
  status: string;
  createdAt: string;
  reporter: { id: string; fullName: string; branch: string } | null;
  stillExists: boolean;
};

const TABS = ["Dashboard", "Users", "Reports"] as const;

export default function AdminPage() {
  const { me } = useApp();
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dashboard");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, r] = await Promise.all([
        api<{ stats: Stats; users: AdminUser[] }>("/api/admin"),
        api<{ items: Report[] }>("/api/admin/reports"),
      ]);
      setStats(d.stats);
      setUsers(d.users);
      setReports(r.items);
    } catch (e) {
      if ((e as Error).message.toLowerCase().includes("administrator")) setDenied(true);
      else toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (me && me.role === "admin") load();
    else if (me) {
      setDenied(true);
      setLoading(false);
    }
  }, [me, load]);

  const act = async (payload: Record<string, unknown>, message: string) => {
    try {
      await api("/api/admin", { method: "PATCH", json: payload });
      toast(message);
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (denied) {
    return (
      <div className="px-4 lg:px-0">
        <EmptyState
          icon={<ShieldAlert size={26} />}
          title="Administrators only"
          body="This dashboard is gated server-side by role. A normal student account can never reach it, even by calling the API directly."
          action={
            <Link href="/home" className="rounded-xl bg-blue px-4 py-2.5 text-sm font-semibold text-white">
              Back to the feed
            </Link>
          }
        />
      </div>
    );
  }

  const cards = stats
    ? [
        { label: "Total users", value: stats.totalUsers, icon: Users, tone: "text-blue" },
        { label: "Active users", value: stats.activeUsers, icon: Users, tone: "text-ok" },
        { label: "Resources", value: stats.totalResources, icon: FileText, tone: "text-blue" },
        { label: "Requests", value: stats.totalRequests, icon: Inbox, tone: "text-violet" },
        { label: "Fulfilled", value: stats.fulfilledRequests, icon: CheckCircle2, tone: "text-ok" },
        { label: "Total likes", value: stats.totalLikes, icon: Heart, tone: "text-flame" },
        { label: "Comments", value: stats.totalComments, icon: MessageSquare, tone: "text-blue" },
        { label: "Open reports", value: stats.openReports, icon: Flag, tone: "text-flame" },
      ]
    : [];

  const filtered = users.filter((u) => {
    const s = search.toLowerCase();
    return (
      !s ||
      u.fullName.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s) ||
      u.rollNumber.toLowerCase().includes(s) ||
      u.branch.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4 px-4 lg:px-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="tblock">Restricted</p>
          <h1 className="font-display text-xl font-extrabold text-ink">Admin dashboard</h1>
        </div>
        <Link href="/home" className="tblock text-blue">
          ← Exit to feed
        </Link>
      </div>

      <div className="flex gap-1 rounded-xl border border-line bg-card p-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex-1 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-all ${
              tab === t ? "bg-rail text-railink" : "text-slate hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      )}

      {tab === "Dashboard" && !loading && stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="card p-4">
              <c.icon size={17} className={c.tone} />
              <p className="num mt-3 text-2xl font-bold text-ink">{fmtCount(c.value)}</p>
              <p className="tblock mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "Users" && !loading && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, roll number or branch…"
              aria-label="Search users"
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
            <span className="tblock shrink-0">{filtered.length}</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto scrollbar-thin">
            {filtered.map((u) => (
              <div key={u.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                <Avatar name={u.fullName} size={38} />
                <div className="min-w-[160px] flex-1">
                  <Link href={`/profile/${u.id}`} className="block truncate text-[14px] font-semibold text-ink hover:text-blue">
                    {u.fullName}
                    {u.role === "admin" && (
                      <span className="ml-2 rounded bg-flame px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">
                        admin
                      </span>
                    )}
                  </Link>
                  <p className="truncate text-[12px] text-slate">
                    {u.email} · {u.rollNumber} · {u.branch}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="num text-[13.5px] font-semibold text-ink">{u.posts} posts</p>
                  <p className="tblock">{fmtCount(u.likes)} likes</p>
                </div>
                <span
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                    u.status === "active"
                      ? "bg-ok/12 text-ok"
                      : "bg-flamewash text-flame"
                  }`}
                >
                  {u.status}
                </span>
                <div className="flex gap-1.5">
                  {u.role !== "admin" && (
                    <>
                      <Button
                        variant="outline"
                        className="!px-2.5 !py-1.5 !text-[12px]"
                        onClick={() =>
                          act(
                            {
                              action: "user-status",
                              userId: u.id,
                              status: u.status === "suspended" ? "active" : "suspended",
                            },
                            u.status === "suspended" ? "User reactivated." : "User suspended.",
                          )
                        }
                      >
                        {u.status === "suspended" ? "Reactivate" : "Suspend"}
                      </Button>
                      <Button
                        variant="danger"
                        className="!px-2.5 !py-1.5 !text-[12px]"
                        onClick={() => {
                          if (confirm(`Delete ${u.fullName} and all their posts?`))
                            act({ action: "user-delete", userId: u.id }, "User deleted.");
                        }}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {!filtered.length && (
              <p className="px-4 py-8 text-center text-sm text-muted">No students match that search.</p>
            )}
          </div>
        </div>
      )}

      {tab === "Reports" && !loading && (
        <div className="card overflow-hidden">
          {reports.length === 0 && (
            <div className="p-4">
              <EmptyState
                icon={<CheckCircle2 size={26} />}
                title="No reports"
                body="Nothing has been flagged by students. This queue stays empty when the community behaves."
              />
            </div>
          )}
          {reports.map((r) => (
            <div key={r.id} className="border-b border-line px-4 py-4 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-wash px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-blue">
                  {r.targetType}
                </span>
                <span className="text-[13.5px] font-semibold text-ink">
                  {r.label ?? "(deleted content)"}
                </span>
                <span
                  className={`ml-auto rounded-md px-2 py-1 text-[11px] font-semibold ${
                    r.status === "open" ? "bg-flamewash text-flame" : "bg-ok/12 text-ok"
                  }`}
                >
                  {r.status}
                </span>
              </div>
              <p className="mt-2 text-[13.5px] text-slate">“{r.reason}”</p>
              <p className="tblock mt-1.5">
                {r.reporter ? `${r.reporter.fullName} (${r.reporter.branch}) · ` : ""}
                {timeAgo(r.createdAt)}
              </p>
              {r.status === "open" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="danger"
                    className="!px-3 !py-1.5 !text-[12.5px]"
                    onClick={() =>
                      act(
                        {
                          action: "remove-content",
                          targetId: r.targetId,
                          targetKind: r.targetType === "comment" ? "comment" : "post",
                        },
                        "Content removed and report resolved.",
                      )
                    }
                    disabled={!r.stillExists}
                  >
                    Remove content
                  </Button>
                  <Button
                    variant="outline"
                    className="!px-3 !py-1.5 !text-[12.5px]"
                    onClick={() => act({ action: "resolve-report", reportId: r.id, status: "dismissed" }, "Report dismissed.")}
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-3 !py-1.5 !text-[12.5px]"
                    onClick={() => act({ action: "resolve-report", reportId: r.id }, "Report resolved.")}
                  >
                    Mark resolved
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
