"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Megaphone, Loader2 } from "lucide-react";
import { Modal, Button, useToast } from "@/components/ui";
import { xhrUpload } from "@/components/PostCard";
import { BRANCHES, SEMESTERS, RESOURCE_TYPES } from "@/lib/constants";

const INPUT =
  "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none transition-colors";
const LABEL = "block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted";

const EXT_OK = [
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".md", ".csv", ".png", ".jpg", ".jpeg", ".webp",
];

export function CreateSheet({
  open,
  onClose,
  defaultKind = "resource",
  subjects,
}: {
  open: boolean;
  onClose: () => void;
  defaultKind?: "resource" | "request";
  subjects?: string[];
}) {
  const toast = useToast();
  const [kind, setKind] = useState<"resource" | "request">(defaultKind);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    branch: BRANCHES[0] as string,
    semester: 3,
    subject: "",
    unit: "",
    resourceType: "Notes" as string,
    tags: "",
  });

  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setProgress(0);
      setError(null);
      setForm((f) => ({ ...f, title: "", description: "", tags: "", unit: "" }));
    }
  }, [open, defaultKind]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0] ?? null;

    if (form.title.trim().length < 4) return setError("Give your post a clear title.");
    if (kind === "resource") {
      if (!file && !form.subject) {
        /* file required for resources */
      }
      if (!file)
        return setError("Attach a file — notes, PYQs, a lab manual, anything usable.");
      const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
      if (!EXT_OK.includes(ext)) return setError("Unsupported file type.");
      if (file.size > 20 * 1024 * 1024) return setError("File exceeds the 20 MB limit.");
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("title", form.title.trim());
      fd.append("description", form.description.trim());
      fd.append("branch", form.branch);
      fd.append("semester", String(form.semester));
      fd.append("subject", form.subject);
      fd.append("unit", form.unit);
      fd.append("resourceType", kind === "resource" ? form.resourceType : "");
      fd.append("tags", form.tags);
      if (file) fd.append("file", file);

      const res = await xhrUpload("/api/posts", fd, setProgress);
      const data = (await res.json()) as { streak?: { current: number } };
      toast(
        kind === "resource"
          ? `Resource published${
              data.streak?.current ? ` — 🔥 ${data.streak.current} day streak` : ""
            }`
          : "Request posted. The network is on it.",
      );
      setForm((f) => ({ ...f, title: "", description: "", tags: "" }));
      if (fileRef.current) fileRef.current.value = "";
      onClose();
      setTimeout(() => location.reload(), 400);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === "resource" ? "Share a resource" : "Ask for a resource"}
      wide
    >
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-paper p-1.5">
        {(
          [
            { k: "resource" as const, icon: FileUp, label: "Resource" },
            { k: "request" as const, icon: Megaphone, label: "Request" },
          ]
        ).map(({ k, icon: Icon, label }) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all ${
              kind === k
                ? k === "request"
                  ? "bg-violet text-white shadow-sm"
                  : "bg-blue text-white shadow-sm"
                : "text-slate hover:text-ink"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={LABEL} htmlFor="c-title">
            {kind === "resource" ? "Resource title" : "What do you need?"}
          </label>
          <input
            id="c-title"
            className={`${INPUT} mt-1.5`}
            value={form.title}
            onChange={set("title")}
            placeholder={
              kind === "resource" ? "DSA Unit 03 Notes" : "Does anyone have OS Unit 03 notes?"
            }
            maxLength={200}
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="c-desc">
            Description
          </label>
          <textarea
            id="c-desc"
            className={`${INPUT} mt-1.5 min-h-[86px] resize-y`}
            value={form.description}
            onChange={set("description")}
            placeholder={
              kind === "resource"
                ? "Complete notes covering Linked Lists, Stack & Queue…"
                : "Need notes covering Process Management, Scheduling and IPC…"
            }
            maxLength={2000}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={LABEL} htmlFor="c-branch">Branch</label>
            <select id="c-branch" className={`${INPUT} mt-1.5`} value={form.branch} onChange={set("branch")}>
              {BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="c-sem">Semester</label>
            <select id="c-sem" className={`${INPUT} mt-1.5`} value={form.semester} onChange={set("semester")}>
              {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="c-unit">Unit</label>
            <input id="c-unit" className={`${INPUT} mt-1.5`} value={form.unit} onChange={set("unit")} placeholder="03" maxLength={40} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="c-subject">Subject</label>
            <input
              id="c-subject"
              list="subject-options"
              className={`${INPUT} mt-1.5`}
              value={form.subject}
              onChange={set("subject")}
              placeholder="Operating Systems"
            />
            <datalist id="subject-options">
              {(subjects ?? []).map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div>
            <label className={LABEL} htmlFor="c-type">Resource type</label>
            <select id="c-type" className={`${INPUT} mt-1.5`} value={form.resourceType} onChange={set("resourceType")}>
              {RESOURCE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="c-tags">Tags</label>
          <input id="c-tags" className={`${INPUT} mt-1.5`} value={form.tags} onChange={set("tags")} placeholder="DSA Unit03 LinkedList CSE" />
          <p className="mt-1 text-[11.5px] text-muted">Separate with spaces or commas.</p>
        </div>

        {kind === "resource" && (
          <div>
            <label className={LABEL} htmlFor="c-file">File</label>
            <input
              id="c-file"
              ref={fileRef}
              type="file"
              accept={EXT_OK.join(",")}
              className="mt-1.5 w-full text-[13px] text-slate file:mr-3 file:rounded-lg file:border-0 file:bg-wash file:px-3.5 file:py-2.5 file:text-[13px] file:font-semibold file:text-blue"
            />
            <p className="mt-1 text-[11.5px] text-muted">
              PDF · DOC/DOCX · PPT/PPTX · images · text — up to 20 MB.
            </p>
          </div>
        )}

        {progress > 0 && (
          <div>
            <div className="flex justify-between text-[11.5px] text-muted">
              <span className="tblock">Uploading</span>
              <span className="num">{progress}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper">
              <div
                className={`h-full transition-all duration-150 ${kind === "request" ? "bg-violet" : "bg-blue"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-flamewash px-3.5 py-2.5 text-[13px] text-flame">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={kind === "request" ? "violet" : "primary"}
            loading={busy}
            disabled={busy}
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" /> {progress}%
              </>
            ) : kind === "resource" ? (
              "Publish resource"
            ) : (
              "Post request"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
