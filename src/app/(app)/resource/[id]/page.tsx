"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Download, Eye, Layers } from "lucide-react";
import type { PostDto } from "@/lib/feed";
import { api, fmtBytes, fmtCount, semLabel } from "@/lib/client";
import { PostCard } from "@/components/PostCard";
import { Avatar, EmptyState, PostSkeleton, useToast } from "@/components/ui";

export default function ResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const toast = useToast();
  const [id, setId] = useState("");
  const [post, setPost] = useState<PostDto | null>(null);
  const [related, setRelated] = useState<PostDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api<{ post: PostDto; related: PostDto[] }>(`/api/posts/${id}`)
      .then((d) => {
        setPost(d.post);
        setRelated(d.related);
      })
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [id, toast]);

  if (loading) {
    return (
      <div className="space-y-4 px-4 lg:px-0">
        <PostSkeleton />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="px-4 lg:px-0">
        <EmptyState
          icon={<FileText size={26} />}
          title="Resource not found"
          body="It may have been removed by its author or by an administrator."
          action={
            <Link href="/home" className="rounded-xl bg-blue px-4 py-2.5 text-sm font-semibold text-white">
              Back to the feed
            </Link>
          }
        />
      </div>
    );
  }

    const targetFile = post.filePath || post.fileName;
    if (!targetFile) return;
    try {
      await api(`/api/posts/${post.id}/engage`, { method: "POST", json: { action: "download" } });
      window.open(`/api/files/${encodeURIComponent(targetFile)}`, "_blank");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="space-y-4 px-4 lg:px-0">
      <Link
        href="/home"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate hover:text-blue"
      >
        <ArrowLeft size={15} /> Back to feed
      </Link>

      {/* metadata title block */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-rail px-5 py-3">
          <span className="tblock text-railink/60">
            {post.kind === "request" ? "Resource request" : "Resource"}
          </span>
          <span className="ml-auto flex items-center gap-4 text-railink/70">
            <span className="inline-flex items-center gap-1.5 text-[12px]">
              <Eye size={14} /> <span className="num">{fmtCount(post.views)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px]">
              <Download size={13} /> <span className="num">{fmtCount(post.downloads)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px]">
              ❤️ <span className="num">{fmtCount(post.likeCount)}</span>
            </span>
          </span>
        </div>

        <dl className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
          {[
            ["Subject", post.subject ?? "—"],
            ["Branch", post.branch ?? "—"],
            ["Semester", semLabel(post.semester)],
            ["Unit", post.unit || "—"],
          ].map(([k, v]) => (
            <div key={k} className="px-4 py-3">
              <dt className="tblock">{k}</dt>
              <dd className="mt-1 truncate text-[13.5px] font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex items-start gap-3 px-5 py-4">
          <Avatar name={post.author.fullName} src={post.author.avatarUrl} size={44} />
          <div className="min-w-0 flex-1">
            <Link href={`/profile/${post.author.id}`} className="font-semibold text-ink hover:text-blue">
              {post.author.fullName}
            </Link>
            <p className="tblock">
              {post.author.branch} • {semLabel(post.author.semester)} ·{" "}
              {post.author.rollNumber}
            </p>
          </div>
          {post.fileName && (
            <button
              onClick={download}
              className="inline-flex items-center gap-2 rounded-xl bg-blue px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-bluepress"
            >
              <Download size={15} /> Download
            </button>
          )}
        </div>

        {post.fileName && (
          <div className="mx-5 mb-5 flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-flamewash text-flame">
              <FileText size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-ink">{post.fileName}</p>
              <p className="num text-[11.5px] text-muted">
                {fmtBytes(post.fileSize)} • {fmtCount(post.downloads)} downloads
              </p>
            </div>
          </div>
        )}
      </section>

      <PostCard post={post} onChange={(_, p) => setPost((s) => (s ? { ...s, ...p } : s))} />

      {/* related */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Layers size={15} className="text-blue" />
          <h2 className="tblock">Related resources</h2>
        </div>
        {related.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">
            Nothing related yet — this subject could use more contributors.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/resource/${r.id}`}
                className="card p-4 transition-all hover:-translate-y-0.5 hover:border-blue"
              >
                <span className="tblock">{r.resourceType ?? r.kind}</span>
                <p className="mt-1.5 line-clamp-2 font-display text-[15px] font-bold leading-snug text-ink">
                  {r.title}
                </p>
                <p className="mt-1 truncate text-[12.5px] text-slate">
                  {r.author.fullName} · {r.branch ?? ""}
                </p>
                <p className="num mt-2 text-[12px] text-muted">
                  ❤️ {r.likeCount} · 💬 {r.commentCount}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
