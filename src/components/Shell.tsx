"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Search,
  Plus,
  Bell,
  User,
  Bookmark,
  Trophy,
  Shield,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Sparkles,
} from "lucide-react";
import { Avatar, Crest, useTheme, type ThemeMode } from "@/components/ui";
import { CreateSheet } from "@/components/CreateSheet";
import { api, fmtCount } from "@/lib/client";

export type Me = {
  id: string;
  fullName: string;
  email: string;
  rollNumber: string;
  branch: string;
  semester: number;
  admissionYear: number;
  bio: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
};

type Ctx = {
  me: Me | null;
  subjects: string[];
  unread: number;
  streak: { current: number; highest: number; postedToday: boolean };
  loading: boolean;
  openCreate: (kind?: "resource" | "request") => void;
  refresh: () => void;
};

const AppCtx = createContext<Ctx>({
  me: null,
  subjects: [],
  unread: 0,
  streak: { current: 0, highest: 0, postedToday: false },
  loading: true,
  openCreate: () => {},
  refresh: () => {},
});
export const useApp = () => useContext(AppCtx);

const NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

const MOBILE_NAV = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "__create", label: "Create", icon: Plus },
  { href: "/notifications", label: "Alerts", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
];

const CHIPS = [
  "All",
  "Notes",
  "PYQ",
  "Assignment",
  "Lab Manual",
  "Question Bank",
  "E-book",
  "Video",
];

/* ------------------------------ theme control ---------------------------- */

function ThemeMenu() {
  const { mode, apply } = useTheme();
  const [open, setOpen] = useState(false);
  const options: { v: ThemeMode; label: string; icon: typeof Sun }[] = [
    { v: "light", label: "Light", icon: Sun },
    { v: "dark", label: "Dark", icon: Moon },
    { v: "system", label: "System", icon: Monitor },
  ];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Change theme"
        className="grid h-9 w-9 place-items-center rounded-xl border border-line text-slate transition-colors hover:border-blue hover:text-blue"
      >
        {mode === "dark" ? <Moon size={16} /> : mode === "light" ? <Sun size={16} /> : <Monitor size={16} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-40 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-xl">
            {options.map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                onClick={() => {
                  apply(v);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px] transition-colors hover:bg-wash ${
                  mode === v ? "font-semibold text-blue" : "text-slate"
                }`}
              >
                <Icon size={15} /> {label}
                {mode === v && <span className="ml-auto text-blue">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------------- widgets -------------------------------- */

function StreakWidget({ compact }: { compact?: boolean }) {
  const { streak, me } = useApp();
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const today = (new Date().getDay() + 6) % 7;
  if (!me) return null;
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="tblock">Daily streak</span>
        <span className="text-flame">🔥</span>
      </div>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="num text-3xl font-semibold text-ink">{streak.current}</span>
        <span className="text-sm font-medium text-slate">day streak</span>
      </p>
      <div className="mt-3 flex justify-between gap-1">
        {days.map((d, i) => {
          const active = streak.postedToday ? i <= today : i < today;
          const isToday = i === today;
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="tblock">{d}</span>
              <span
                className={`grid h-7 w-7 place-items-center rounded-lg text-[13px] ${
                  active
                    ? "bg-flamewash text-flame"
                    : isToday
                      ? "border border-dashed border-flame text-flame"
                      : "bg-paper text-muted"
                }`}
              >
                {active ? "✓" : isToday ? "•" : "·"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-muted">
        {streak.postedToday ? (
          <span className="font-semibold text-flame">You posted today ✓</span>
        ) : (
          "Post a resource today to keep it alive."
        )}
      </p>
      {compact && (
        <p className="mt-2 tblock">
          Best: <span className="num">{streak.highest}</span> days
        </p>
      )}
    </div>
  );
}

function TrendingWidget() {
  const [items, setItems] = useState<
    { id: string; title: string; resourceType: string | null }[]
  >([]);
  useEffect(() => {
    api<{ trending: { id: string; title: string; resourceType: string | null }[] }>(
      "/api/explore",
    )
      .then((d) => setItems(d.trending.slice(0, 5)))
      .catch(() => setItems([]));
  }, []);
  if (!items.length) return null;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5">
        <Sparkles size={13} className="text-flame" />
        <span className="tblock">Trending resources</span>
      </div>
      <ol className="mt-3 space-y-2.5">
        {items.map((t, i) => (
          <li key={t.id}>
            <Link
              href={`/resource/${t.id}`}
              className="flex items-start gap-2.5 text-[13.5px] leading-snug text-slate transition-colors hover:text-blue"
            >
              <span className="num mt-px w-4 shrink-0 text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MiniLeaderboard() {
  const [items, setItems] = useState<
    { rank: number; id: string; fullName: string; totalLikes: number }[]
  >([]);
  useEffect(() => {
    api<{ items: typeof items }>("/api/leaderboard?range=overall")
      .then((d) => setItems(d.items.slice(0, 5)))
      .catch(() => setItems([]));
  }, []);
  if (!items.length) return null;
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className="tblock">🏆 Academic contributors</span>
        <Link href="/leaderboard" className="text-[12px] font-semibold text-blue">
          All
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {items.map((u) => (
          <li key={u.id}>
            <Link
              href={`/profile/${u.id}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-wash"
            >
              <span className="num w-5 text-[13px] text-muted">{u.rank}</span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                {u.fullName}
              </span>
              <span className="num text-[13px] font-semibold text-blue">
                {fmtCount(u.totalLikes)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------- shell --------------------------------- */

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [unread, setUnread] = useState(0);
  const [streak, setStreak] = useState({
    current: 0,
    highest: 0,
    postedToday: false,
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<null | "resource" | "request">(null);
  const [query, setQuery] = useState("");

  const refresh = useCallback(() => {
    api<{
      user: Me;
      subjects: string[];
      unread: number;
      streak: { current: number; highest: number; postedToday: boolean };
    }>("/api/auth/me")
      .then((d) => {
        setMe(d.user);
        setSubjects(d.subjects);
        setUnread(d.unread);
        setStreak(d.streak);
      })
      .catch(() => {
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const on = () => setUnread((n) => n);
    window.addEventListener("bpm:refresh", on);
    return () => window.removeEventListener("bpm:refresh", on);
  }, []);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  const openCreate = useCallback((kind: "resource" | "request" = "resource") => {
    setCreating(kind);
  }, []);

  const [chipValue, setChipValue] = useState("All");
  useEffect(() => {
    setChipValue(new URLSearchParams(window.location.search).get("type") ?? "All");
  }, [pathname]);

  return (
    <AppCtx.Provider
      value={{ me, subjects, unread, streak, loading, openCreate, refresh }}
    >
      <div className="min-h-dvh">
        {/* ── mobile header ── */}
        <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <Link href="/home" className="flex min-w-0 items-center gap-2.5">
              <Crest className="h-9 w-9 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate font-display text-[15px] font-bold leading-tight text-ink">
                  B.P. Mandal
                </span>
                <span className="block truncate text-[11px] font-medium leading-tight text-slate">
                  College of Engineering
                </span>
                <span className="tblock block leading-tight">Learn · Share · Grow</span>
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-1.5">
              <Link
                href="/explore"
                aria-label="Search"
                className="grid h-9 w-9 place-items-center rounded-xl text-slate hover:bg-wash"
              >
                <Search size={19} />
              </Link>
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="relative grid h-9 w-9 place-items-center rounded-xl text-slate hover:bg-wash"
              >
                <Bell size={19} />
                {unread > 0 && (
                  <span className="num absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-flame px-1 text-[9px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <ThemeMenu />
              <Link href="/profile" aria-label="Your profile">
                <Avatar name={me?.fullName ?? "…"} src={me?.avatarUrl} size={34} />
              </Link>
            </div>
          </div>

          {/* scrollable category strip */}
          <div className="no-bar flex gap-2 overflow-x-auto px-4 pb-2.5">
            <button
              onClick={() => openCreate("resource")}
              className="flex shrink-0 flex-col items-center gap-1"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-blue text-white shadow-sm">
                <Plus size={20} />
              </span>
              <span className="text-[10.5px] font-medium text-slate">Create</span>
            </button>
            {CHIPS.map((c) => (
              <Link
                key={c}
                href={`/explore?type=${encodeURIComponent(c === "All" ? "" : c)}`}
                className={`flex shrink-0 flex-col items-center gap-1 rounded-lg px-1 transition-colors ${
                  chipValue === c ? "text-blue" : "text-slate"
                }`}
              >
                <span
                  className={`grid h-11 w-11 place-items-center rounded-full text-[11px] font-semibold ${
                    chipValue === c ? "bg-blue text-white shadow-sm" : "bg-wash text-slate"
                  }`}
                >
                  {c.slice(0, 4)}
                </span>
                <span className="whitespace-nowrap text-[10.5px] font-medium">{c}</span>
              </Link>
            ))}
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1440px] gap-6 px-0 lg:px-6">
          {/* ── desktop left rail: dark title-block panel ── */}
          <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col bg-rail py-6 lg:flex">
            <Link href="/home" className="flex items-center gap-2.5 px-5">
              <Crest className="h-10 w-10" />
              <span>
                <span className="block font-display text-[15px] font-bold leading-tight text-railink">
                  B.P. Mandal
                </span>
                <span className="block text-[11px] leading-tight text-railink/60">
                  College of Engineering
                </span>
              </span>
            </Link>
            <p className="tblock mt-3 px-5 text-railink/45">Learn · Share · Grow</p>

            <nav className="mt-7 flex-1 space-y-1 px-3" aria-label="Primary">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-all duration-150 ${
                      active
                        ? "bg-blue text-white font-semibold"
                        : "text-railink/70 hover:bg-white/8 hover:text-railink"
                    }`}
                  >
                    <Icon size={19} />
                    {label}
                    {href === "/notifications" && unread > 0 && (
                      <span className="num ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-flame px-1.5 text-[10px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </Link>
                );
              })}
              <button
                onClick={() => openCreate("resource")}
                className="mt-3 flex w-full items-center gap-3 rounded-xl bg-blue px-3 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-bluepress"
              >
                <Plus size={19} /> Create
              </button>
              {me?.role === "admin" && (
                <Link
                  href="/admin"
                  className={`mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-all ${
                    pathname.startsWith("/admin")
                      ? "bg-flame text-white font-semibold"
                      : "text-railink/70 hover:bg-white/8"
                  }`}
                >
                  <Shield size={19} /> Admin
                </Link>
              )}
            </nav>

            <div className="mx-3 rounded-xl border border-railline p-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={me?.fullName ?? "…"} src={me?.avatarUrl} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-railink">
                    {me?.fullName}
                  </p>
                  <p className="truncate text-[11px] text-railink/55">
                    {me?.branch} • Sem {me?.semester}
                  </p>
                </div>
                <ThemeMenu />
                <button
                  onClick={logout}
                  aria-label="Log out"
                  className="grid h-9 w-9 place-items-center rounded-xl text-railink/60 transition-colors hover:bg-white/8 hover:text-flame"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </aside>

          {/* ── main column ── */}
          <main className="min-w-0 flex-1 pb-28 pt-4 lg:pt-6 lg:pb-12 lg:max-w-[720px]">
            {children}
          </main>

          {/* ── right rail ── */}
          <aside className="sticky top-6 hidden h-fit w-[300px] shrink-0 space-y-4 xl:block">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/explore?q=${encodeURIComponent(query)}`);
              }}
              role="search"
              className="card flex items-center gap-2 px-3 py-2.5"
            >
              <Search size={16} className="text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes, PYQs, people…"
                aria-label="Search the hub"
                className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
              />
            </form>
            <StreakWidget />
            <TrendingWidget />
            <MiniLeaderboard />
            <p className="px-1 text-[11px] leading-relaxed text-muted">
              B.P. Mandal Academic Hub — a student-run resource network for
              Madhepura. Academic posts only.
            </p>
          </aside>
        </div>

        {/* ── mobile bottom nav ── */}
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/97 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          <div className="grid grid-cols-5">
            {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
              if (href === "__create") {
                return (
                  <button
                    key="create"
                    onClick={() => openCreate("resource")}
                    aria-label="Create post"
                    className="relative flex flex-col items-center gap-1 pt-1"
                  >
                    <span className="-mt-6 grid h-14 w-14 place-items-center rounded-full border-4 border-card bg-blue text-white shadow-lg shadow-blue/40">
                      <Plus size={26} />
                    </span>
                    <span className="text-[10px] font-semibold text-blue">Create</span>
                  </button>
                );
              }
              const active = pathname.startsWith(href);
              const isProfile = href === "/profile";
              const target = isProfile && me ? `/profile/${me.id}` : href;
              return (
                <Link
                  key={href}
                  href={target}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex flex-col items-center gap-1 py-2.5 transition-colors ${
                    active ? "text-blue" : "text-muted"
                  }`}
                >
                  <span className="relative">
                    <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                    {href === "/notifications" && unread > 0 && (
                      <span className="num absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-flame px-1 text-[9px] font-bold text-white">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-semibold">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <CreateSheet
          open={creating !== null}
          defaultKind={creating ?? "resource"}
          onClose={() => setCreating(null)}
          subjects={subjects}
        />
      </div>
    </AppCtx.Provider>
  );
}
