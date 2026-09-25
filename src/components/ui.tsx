"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { initials, hueOf } from "@/lib/client";

/* ------------------------------- college crest --------------------------- */

export function Crest({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 72"
      className={className}
      role="img"
      aria-label="B.P. Mandal College of Engineering crest"
    >
      <defs>
        <linearGradient id="crestInk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--blue)" />
          <stop offset="1" stopColor="var(--blue-press)" />
        </linearGradient>
      </defs>
      {/* shield */}
      <path
        d="M32 2 L60 11.5 V38.5 C60 55.5 47.5 66.5 32 70.5 C16.5 66.5 4 55.5 4 38.5 V11.5 Z"
        fill="url(#crestInk)"
      />
      <path
        d="M32 7.5 L54.5 15.2 V38.2 C54.5 52 44.2 61.4 32 65.4 C19.8 61.4 9.5 52 9.5 38.2 V15.2 Z"
        fill="var(--card)"
        opacity="0.14"
      />
      {/* rising chevron — "Grow" */}
      <path
        d="M20.5 30.5 L32 20 L43.5 30.5"
        fill="none"
        stroke="var(--card)"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* open book — "Learn" */}
      <path
        d="M14.5 38.5 C20 34.6 26.4 34.9 31.2 38.4 V55.6 C26.4 52.1 20 51.8 14.5 55.7 Z"
        fill="var(--card)"
      />
      <path
        d="M49.5 38.5 C44 34.6 37.6 34.9 32.8 38.4 V55.6 C37.6 52.1 44 51.8 49.5 55.7 Z"
        fill="var(--card)"
      />
      <path d="M32 39.4 V56.6" stroke="var(--blue-press)" strokeWidth="1.6" />
      {/* share bar — "Share" */}
      <rect x="24" y="60.6" width="16" height="3.4" rx="1.7" fill="var(--card)" opacity="0.85" />
    </svg>
  );
}

/* --------------------------------- avatar -------------------------------- */

export function Avatar({
  name,
  src,
  size = 40,
  ring = false,
}: {
  name: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const hue = hueOf(name || "bp");
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.36) };
  const cls = `shrink-0 rounded-full object-cover overflow-hidden grid place-items-center font-mono font-semibold text-white select-none ${
    ring ? "ring-2 ring-blue ring-offset-2 ring-offset-card" : ""
  }`;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name} profile picture`}
        width={size}
        height={size}
        style={style}
        className={cls}
        loading="lazy"
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cls}
      style={{
        ...style,
        background: `linear-gradient(140deg, hsl(${hue} 62% 52%), hsl(${(hue + 42) % 360} 68% 40%))`,
      }}
    >
      {initials(name)}
    </span>
  );
}

/* -------------------------------- toasts -------------------------------- */

type Toast = { id: number; message: string; kind: "ok" | "error" | "info" };
const ToastCtx = createContext<(message: string, kind?: Toast["kind"]) => void>(
  () => {},
);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="sheet pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border border-line bg-card px-4 py-3 text-sm text-ink shadow-xl shadow-black/10"
          >
            {t.kind === "ok" && <CheckCircle2 size={17} className="mt-0.5 text-ok shrink-0" />}
            {t.kind === "error" && (
              <AlertTriangle size={17} className="mt-0.5 text-flame shrink-0" />
            )}
            {t.kind === "info" && <Info size={17} className="mt-0.5 text-blue shrink-0" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* -------------------------------- skeleton ------------------------------- */

export function PostSkeleton() {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3 w-40 rounded" />
          <div className="skeleton h-2.5 w-24 rounded" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-5/6 rounded" />
      </div>
      <div className="skeleton mt-4 h-40 w-full rounded-xl" />
      <div className="mt-4 flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-4 w-14 rounded" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- empty state ----------------------------- */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-wash text-blue">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* --------------------------------- button -------------------------------- */

export function Button({
  children,
  variant = "primary",
  className = "",
  loading,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger" | "violet";
  loading?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98]";
  const variants: Record<string, string> = {
    primary: "bg-blue text-white hover:bg-bluepress shadow-sm",
    ghost: "text-slate hover:bg-wash hover:text-blue",
    outline: "border border-line bg-card text-ink hover:border-blue hover:text-blue",
    danger: "bg-flame text-white hover:brightness-90",
    violet: "bg-violet text-white hover:brightness-90",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

/* --------------------------------- modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-rail/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`sheet relative max-h-[92dvh] w-full overflow-y-auto scrollbar-thin rounded-t-3xl border border-line bg-card p-5 shadow-2xl sm:rounded-3xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate hover:bg-wash hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------ theme switch ----------------------------- */

export type ThemeMode = "light" | "dark" | "system";

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("system");
  useEffect(() => {
    const stored = (localStorage.getItem("bpm-theme") as ThemeMode) || "system";
    setMode(stored);
  }, []);
  const apply = useCallback((next: ThemeMode) => {
    localStorage.setItem("bpm-theme", next);
    const dark =
      next === "dark" ||
      (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    setMode(next);
  }, []);
  return { mode, apply };
}

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return useMemo(() => now, [now]);
}
