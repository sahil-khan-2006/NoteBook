"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, UserPlus, BookOpen, Megaphone, Bell, CheckCheck } from "lucide-react";
import { Avatar, Button, EmptyState, useToast } from "@/components/ui";
import { api, timeAgo } from "@/lib/client";

type Item = {
  id: string;
  type: string;
  body: string;
  read: boolean;
  postId: string | null;
  postTitle: string | null;
  createdAt: string;
  actor: { id: string; fullName: string; branch: string; avatarUrl: string | null } | null;
};

const ICONS: Record<string, React.ReactNode> = {
  like: <Heart size={15} className="text-flame" />,
  comment: <MessageCircle size={15} className="text-blue" />,
  reply: <MessageCircle size={15} className="text-blue" />,
  follow: <UserPlus size={15} className="text-violet" />,
  fulfill: <BookOpen size={15} className="text-ok" />,
  request_interact: <Megaphone size={15} className="text-violet" />,
  new_resource: <BookOpen size={15} className="text-blue" />,
};

export default function NotificationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api<{ items: Item[]; unread: number }>("/api/notifications")
      .then((d) => {
        setItems(d.items);
        setUnread(d.unread);
      })
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async (n: Item) => {
    if (!n.read) {
      await api("/api/notifications", { method: "PATCH", json: { id: n.id } });
      setItems((prev) => prev.map((p) => (p.id === n.id ? { ...p, read: true } : p)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.postId) location.href = `/resource/${n.postId}`;
    else if (n.actor) location.href = `/profile/${n.actor.id}`;
  };

  const markAll = async () => {
    await api("/api/notifications", { method: "PATCH", json: { all: true } });
    setItems((prev) => prev.map((p) => ({ ...p, read: true })));
    setUnread(0);
    toast("All caught up.");
  };

  return (
    <div className="space-y-4 px-4 lg:px-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-ink">Notifications</h1>
          <p className="tblock mt-0.5">
            {unread > 0 ? `${unread} unread` : "All caught up"}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" className="!py-2 !text-[13px]" onClick={markAll}>
            <CheckCheck size={15} /> Mark all read
          </Button>
        )}
      </div>

      <div className="card divide-y divide-line overflow-hidden">
        {loading &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className="skeleton h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-2/3 rounded" />
                <div className="skeleton h-2.5 w-1/4 rounded" />
              </div>
            </div>
          ))}

        {!loading && items.length === 0 && (
          <div className="p-4">
            <EmptyState
              icon={<Bell size={26} />}
              title="You’re all caught up"
              body="Likes, comments, new followers and fulfilled requests will show up here."
            />
          </div>
        )}

        {!loading &&
          items.map((n) => (
            <button
              key={n.id}
              onClick={() => open(n)}
              className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-wash ${
                n.read ? "" : "bg-wash/60"
              }`}
            >
              <Avatar name={n.actor?.fullName ?? "Hub"} src={n.actor?.avatarUrl} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-snug text-ink">
                  <b>{n.actor?.fullName ?? "System"}</b> {n.body}
                </p>
                {n.postTitle && (
                  <p className="mt-0.5 truncate text-[12.5px] text-blue">{n.postTitle}</p>
                )}
                <p className="tblock mt-1">{timeAgo(n.createdAt)}</p>
              </div>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-paper">
                {ICONS[n.type] ?? <Heart size={15} className="text-muted" />}
              </span>
              {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue" />}
            </button>
          ))}
      </div>

      <p className="pb-4 text-center">
        <Link href="/home" className="tblock text-blue">
          Back to the feed
        </Link>
      </p>
    </div>
  );
}
