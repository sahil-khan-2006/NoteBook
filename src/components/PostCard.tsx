"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  Download,
  Eye,
  Flag,
  MoreHorizontal,
  FileText,
  Send,
  Trash2,
  Reply,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import type { PostDto, AuthorDto } from "@/lib/feed";
import { api, fmtCount, fmtBytes, semLabel, timeAgo } from "@/lib/client";
import { Avatar, Button, useToast } from "@/components/ui";

type Patch = Partial<{
  liked: boolean;
  saved: boolean;
  likeCount: number;
  saveCount: number;
  commentCount: number;
  status: string;
}>;

const typeTone: Record<string, string> = {
  Resource: "bg-wash text-blue",
  Request: "bg-violetwash text-violet",
};

/* ================================ comments =============================== */

type CommentDto = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  isAuthor: boolean;
  author: AuthorDto;
  replies: CommentDto[];
};

export function Comments({
  postId,
  count,
  onCount,
  forceOpen = 0,
}: {
  postId: string;
  count: number;
  onCount: (n: number) => void;
  forceOpen?: number;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CommentDto[]>([]);
  const [total, setTotal] = useState(count);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTotal(count);
  }, [count]);

  useEffect(() => {
    if (forceOpen > 0) setOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    if (!open || loaded) return;
    let alive = true;
    setLoading(true);
    api<{ items: CommentDto[]; total: number }>(`/api/posts/${postId}/comments`)
      .then((d) => {
        if (!alive) return;
        setItems(d.items);
        setTotal(d.total);
        setLoaded(true);
      })
      .catch((e) => {
        if (alive) toast(e.message, "error");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, loaded, postId, toast]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const res = await api<{ comment: CommentDto; count: number }>(
        `/api/posts/${postId}/comments`,
        { method: "POST", json: { body: text, parentId: replyTo?.id ?? null } },
      );
      setItems((prev) => {
        if (!res.comment.parentId) return [...prev, res.comment];
        return prev.map((c) =>
          c.id === res.comment.parentId
            ? { ...c, replies: [...c.replies, res.comment] }
            : c,
        );
      });
      setTotal(res.count);
      onCount(res.count);
      setText("");
      setReplyTo(null);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api("/api/posts/" + postId + "/comments", { method: "DELETE", json: { id } });
      setItems((prev) =>
        prev
          .filter((c) => c.id !== id)
          .map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== id) })),
      );
      setTotal((n) => Math.max(0, n - 1));
      onCount(Math.max(0, total - 1));
      toast("Comment deleted.");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const Row = ({ c, isReply }: { c: CommentDto; isReply?: boolean }) => (
    <div className={`flex gap-2.5 ${isReply ? "pl-8" : ""}`}>
      <Avatar name={c.author.fullName} src={c.author.avatarUrl} size={isReply ? 26 : 32} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-wash px-3.5 py-2.5">
          <div className="flex items-baseline gap-2">
            <Link
              href={`/profile/${c.author.id}`}
              className="truncate text-[13px] font-semibold text-ink hover:text-blue"
            >
              {c.author.fullName}
            </Link>
            <span className="tblock shrink-0">{timeAgo(c.createdAt)}</span>
          </div>
          <p className="mt-0.5 break-words text-[13.5px] leading-relaxed text-slate">
            {c.body}
          </p>
        </div>
        <div className="mt-1 flex items-center gap-3 px-2 text-[11px] text-muted">
          <button
            onClick={() => setReplyTo(replyTo?.id === c.id ? null : c)}
            className="inline-flex items-center gap-1 font-medium text-muted hover:text-blue"
          >
            <Reply size={12} /> Reply
          </button>
          {c.isAuthor && (
            <button
              onClick={() => remove(c.id)}
              className="inline-flex items-center gap-1 font-medium text-muted hover:text-flame"
            >
              <Trash2 size={12} /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="mt-3">
      {!open && total > 0 && (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-xl bg-wash px-3.5 py-2.5 text-left text-[13px] transition-colors hover:bg-line/60"
        >
          <span className="line-clamp-1 text-slate">
            {items[0] ? (
              <>
                <b className="text-ink">{items[0].author.fullName}:</b> {items[0].body}
              </>
            ) : (
              "View all comments"
            )}
          </span>
          <span className="mt-0.5 block font-semibold text-blue">
            View all {total} comment{total === 1 ? "" : "s"}
          </span>
        </button>
      )}

      {open && (
        <div className="space-y-3.5 rounded-xl border border-line p-3.5">
          {loading && (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="skeleton h-8 w-8 rounded-full" />
                  <div className="skeleton h-10 flex-1 rounded-xl" />
                </div>
              ))}
            </div>
          )}
          {!loading && !items.length && (
            <p className="py-3 text-center text-sm text-muted">
              No comments yet. Be the first to help.
            </p>
          )}
          {items.map((c) => (
            <div key={c.id} className="space-y-3">
              <Row c={c} />
              {c.replies.map((r) => (
                <Row key={r.id} c={r} isReply />
              ))}
            </div>
          ))}

          <form onSubmit={submit} className="flex items-end gap-2 pt-1">
            <Avatar name="you" size={30} />
            <div className="flex-1">
              {replyTo && (
                <div className="mb-1 flex items-center gap-1.5 text-[11px] text-blue">
                  Replying to <b className="truncate">{replyTo.author.fullName}</b>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-muted hover:text-flame"
                  >
                    ✕
                  </button>
                </div>
              )}
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
                aria-label="Write a comment"
                className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none"
              />
            </div>
            <Button
              type="submit"
              disabled={!text.trim() || busy}
              aria-label="Post comment"
              className="!px-3 !py-2.5"
            >
              <Send size={15} />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ================================ post card ============================== */

export function PostCard({
  post,
  onChange,
  compactHeader,
}: {
  post: PostDto;
  onChange?: (id: string, patch: Patch) => void;
  compactHeader?: boolean;
}) {
  const toast = useToast();
  const [state, setState] = useState<PostDto>(post);
  const [menu, setMenu] = useState(false);
  const [justLiked, setJustLiked] = useState(false);
  const [showFulfil, setShowFulfil] = useState(false);
  const [forceOpen, setForceOpen] = useState(0);

  useEffect(() => setState(post), [post]);

  const patch = (p: Patch) => {
    setState((s) => ({ ...s, ...p }));
    onChange?.(post.id, p);
  };

  const engage = async (action: "like" | "save") => {
    const next = action === "like" ? !state.liked : !state.saved;
    patch(
      action === "like"
        ? { liked: next, likeCount: state.likeCount + (next ? 1 : -1) }
        : { saved: next, saveCount: state.saveCount + (next ? 1 : -1) },
    );
    if (action === "like" && next) {
      setJustLiked(true);
      setTimeout(() => setJustLiked(false), 300);
    }
    try {
      const res = await api<{ liked?: boolean; saved?: boolean; count: number }>(
        `/api/posts/${post.id}/engage`,
        { method: "POST", json: { action } },
      );
      patch(
        action === "like"
          ? { liked: res.liked, likeCount: res.count }
          : { saved: res.saved, saveCount: res.count },
      );
    } catch (e) {
      patch(
        action === "like"
          ? { liked: !next, likeCount: state.likeCount }
          : { saved: !next, saveCount: state.saveCount },
      );
      toast((e as Error).message, "error");
    }
  };

  const download = async () => {
    if (!state.fileName) return;
    try {
      await api(`/api/posts/${post.id}/engage`, {
        method: "POST",
        json: { action: "download" },
      });
      const targetFile = state.filePath || state.fileName;
      window.open(`/api/files/${encodeURIComponent(targetFile)}`, "_blank");
      toast("Download started.");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const share = async () => {
    const url = `${location.origin}/resource/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: state.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied to clipboard.");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const report = async () => {
    const reason = window.prompt("What is wrong with this post?");
    if (!reason) return;
    try {
      await api(`/api/posts/${post.id}/engage`, {
        method: "POST",
        json: { action: "report", reason },
      });
      toast("Report submitted. Our admins will review it.");
    } catch (e) {
      toast((e as Error).message, "error");
    }
    setMenu(false);
  };

  const isRequest = state.kind === "request";
  const previewUrl = state.thumbUrl
    ? state.thumbUrl.startsWith("/") || state.thumbUrl.startsWith("http")
      ? state.thumbUrl
      : `/api/files/${state.thumbUrl}`
    : null;

  return (
    <article
      className={`card rise overflow-hidden ${isRequest ? "border-l-[3px] border-l-violet" : ""}`}
    >
      {/* ── header: ruled margin, like a record-book entry ── */}
      <header className="ruled flex items-start gap-3 pl-4 pr-3 pt-4 sm:pl-5 sm:pr-4 sm:pt-5">
        <Link href={`/profile/${state.author.id}`} aria-label={state.author.fullName}>
          <Avatar name={state.author.fullName} src={state.author.avatarUrl} size={42} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              href={`/profile/${state.author.id}`}
              className="font-semibold text-ink hover:text-blue inline-flex items-center gap-1.5"
            >
              {state.author.fullName}
            </Link>
            {state.author.role === "professor" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/30">
                Professor
              </span>
            )}
            <span className="tblock truncate">
              {state.author.role === "professor"
                ? `${state.author.branch} • Faculty`
                : `${state.author.branch} • ${semLabel(state.author.semester)}`}
            </span>
          </div>
          <div className="tblock mt-0.5">
            {timeAgo(state.createdAt)}
            {state.unit ? ` • Unit ${state.unit}` : ""}
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
            isRequest ? typeTone.Request : typeTone.Resource
          }`}
        >
          {isRequest ? (
            <>
              🙋 Request
            </>
          ) : (
            <>
              <FileText size={12} /> {state.resourceType ?? "Resource"}
            </>
          )}
        </span>
        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Post options"
            className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-wash hover:text-ink"
          >
            <MoreHorizontal size={16} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-xl">
                <button
                  onClick={report}
                  className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-slate hover:bg-wash hover:text-flame"
                >
                  <Flag size={14} /> Report post
                </button>
                {(state.viewerIsAuthor || false) && (
                  <button
                    onClick={async () => {
                      if (!confirm("Delete this post permanently?")) return;
                      try {
                        await api(`/api/posts/${post.id}`, { method: "DELETE" });
                        setState((s) => ({ ...s, title: "" }));
                        toast("Post removed.");
                        location.reload();
                      } catch (e) {
                        toast((e as Error).message, "error");
                      }
                    }}
                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] text-flame hover:bg-flamewash"
                  >
                    <Trash2 size={14} /> Delete post
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── body ── */}
      <div className={`px-4 pt-3 sm:px-5 ${compactHeader ? "" : ""}`}>
        {isRequest && (
          <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-lg bg-violetwash px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-violet">
            Resource Request
          </div>
        )}
        <h2 className="font-display text-[19px] font-bold leading-snug text-ink sm:text-xl">
          {state.title}
        </h2>
        {state.description && (
          <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] leading-relaxed text-slate">
            {state.description}
          </p>
        )}

        {isRequest && (
          <div className="mt-3 flex flex-wrap gap-2">
            {state.branch && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-slate">
                <span className="text-blue">◆</span> Branch: {state.branch}
              </span>
            )}
            {state.semester && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-slate">
                <span className="text-blue">▣</span> Semester: {semLabel(state.semester)}
              </span>
            )}
            {state.subject && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-slate">
                <span className="text-blue">▤</span> Subject: {state.subject}
              </span>
            )}
          </div>
        )}

        {state.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {state.tags.map((t) => (
              <Link
                key={t}
                href={`/explore?tag=${encodeURIComponent(t)}`}
                className="rounded-md bg-wash px-2 py-1 text-[12px] font-medium text-blue transition-colors hover:bg-blue hover:text-white"
              >
                #{t}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── preview / title-block file strip ── */}
      <div className="mt-3 grid gap-3 px-4 sm:grid-cols-[1fr_auto] sm:px-5">
        <div className="min-w-0">
          {state.fileName ? (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-flamewash text-flame">
                <FileText size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">
                  {state.fileName}
                </p>
                <p className="num mt-0.5 text-[11.5px] text-muted">
                  {fmtBytes(state.fileSize)}
                  {state.filePages ? ` • ${state.filePages} pages` : ""}
                  {" • "}
                  {state.downloads} downloads
                </p>
              </div>
              <button
                onClick={download}
                aria-label={`Download ${state.fileName}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-blue transition-colors hover:bg-blue hover:text-white"
              >
                <Download size={17} />
              </button>
            </div>
          ) : isRequest ? (
            <div className="rounded-xl border border-dashed border-violet/50 bg-violetwash px-3.5 py-3 text-[13px] text-violet">
              {state.status === "fulfilled" ? (
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 size={15} /> Fulfilled
                </span>
              ) : (
                "Waiting for a peer to share this resource."
              )}
            </div>
          ) : null}

          {isRequest && state.status === "fulfilled" && state.fulfilledBy && (
            <div className="mt-2 rounded-xl border border-ok/40 bg-ok/10 p-3.5">
              <p className="tblock text-ok">✓ Request Fulfilled</p>
              <div className="mt-2 space-y-1 text-[13px] text-slate">
                <p>
                  Requested by <b className="text-ink">{state.author.fullName}</b>
                </p>
                <p>
                  Resource provided by <b className="text-ink">{state.fulfilledBy.fullName}</b>
                </p>
              </div>
              {state.fulfilledPostId && (
                <Link
                  href={`/resource/${state.fulfilledPostId}`}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-ok px-3 py-1.5 text-[13px] font-semibold text-white hover:brightness-95"
                >
                  View Resource <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
          )}
        </div>

        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`Cover for ${state.title}`}
            loading="lazy"
            className="h-40 w-full rounded-xl border border-line object-cover sm:h-32 sm:w-56"
          />
        ) : !state.fileName && !isRequest ? (
          <div className="hidden h-32 w-56 place-items-center rounded-xl border border-dashed border-line bg-paper text-center text-[12px] text-muted sm:grid">
            No preview available
          </div>
        ) : null}
      </div>

      {/* ── title-block action strip ── */}
      <div className="mt-3.5 flex flex-wrap items-center gap-1 border-t border-line px-3 py-2 sm:px-4">
        <button
          onClick={() => engage("like")}
          aria-pressed={state.liked}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
            state.liked ? "text-flame" : "text-slate hover:bg-wash"
          }`}
        >
          <Heart size={17} fill={state.liked ? "currentColor" : "none"} className={justLiked ? "pop" : ""} />
          <span className="num">{fmtCount(state.likeCount)}</span>
        </button>
        <button
          onClick={() => setForceOpen((n) => n + 1)}
          aria-label="Show comments"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate transition-colors hover:bg-wash"
        >
          <MessageCircle size={17} />
          <span className="num">{fmtCount(state.commentCount)}</span>
        </button>
        <button
          onClick={() => engage("save")}
          aria-pressed={state.saved}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
            state.saved ? "text-blue" : "text-slate hover:bg-wash"
          }`}
        >
          <Bookmark size={17} fill={state.saved ? "currentColor" : "none"} />
          {state.saved ? "Saved" : "Save"}
        </button>
        <button
          onClick={share}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate transition-colors hover:bg-wash"
        >
          <Share2 size={16} /> Share
        </button>
        {isRequest && state.status !== "fulfilled" && !state.viewerIsAuthor && (
          <Button
            variant="violet"
            className="ml-auto !py-1.5 !text-[13px]"
            onClick={() => setShowFulfil(true)}
          >
            Fulfill Request
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3 pr-1 text-[12px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Eye size={14} /> <span className="num">{fmtCount(state.views)}</span>
          </span>
          {state.fileName && (
            <span className="hidden items-center gap-1 sm:inline-flex">
              <Download size={13} /> <span className="num">{fmtCount(state.downloads)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="px-3 pb-4 sm:px-4">
        <Comments
          postId={post.id}
          count={state.commentCount}
          forceOpen={forceOpen}
          onCount={(n) => patch({ commentCount: n })}
        />
        {isRequest && showFulfil && (
          <FulfilForm
            postId={post.id}
            onClose={() => setShowFulfil(false)}
            onDone={(postId) => {
              patch({ status: "fulfilled" });
              toast(`You fulfilled ${state.author.fullName}'s request.`);
              setShowFulfil(false);
              if (postId) location.href = `/resource/${postId}`;
            }}
          />
        )}
      </div>
    </article>
  );
}

/* ============================ fulfilment form ============================ */

function FulfilForm({
  postId,
  onClose,
  onDone,
}: {
  postId: string;
  onClose: () => void;
  onDone: (postId?: string) => void;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast("Attach a file to fulfil this request.", "error");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("file", file);
      const res = await xhrUpload(`/api/requests/${postId}/fulfill`, fd, setProgress);
      const data = (await res.json()) as { fulfilledPostId?: string };
      onDone(data.fulfilledPostId);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mt-3 rounded-xl border border-violet/40 bg-violetwash p-4"
    >
      <p className="tblock text-violet">Fulfill this request</p>
      <label className="mt-3 block text-[13px] font-semibold text-ink">
        Resource title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. OS Unit 03 Notes"
          className="mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm font-normal text-ink focus:border-blue focus:outline-none"
        />
      </label>
      <label className="mt-3 block text-[13px] font-semibold text-ink">
        File (PDF, DOC, PPT, image — max 5 MB)
        <input
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 w-full text-[13px] font-normal text-slate file:mr-3 file:rounded-lg file:border-0 file:bg-blue file:px-3 file:py-2 file:text-[13px] file:font-semibold file:text-white"
        />
      </label>
      {progress > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-card">
          <div className="h-full bg-violet transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <Button type="submit" variant="violet" loading={busy} disabled={busy}>
          {busy ? `Uploading ${progress}%` : "Submit & fulfil"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** XHR so we can report real upload progress. */
export function xhrUpload(
  url: string,
  form: FormData,
  onProgress?: (pct: number) => void,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(new Response(xhr.responseText));
      else
        reject(
          new Error((data as { error?: string } | null)?.error ?? "Upload failed"),
        );
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}
