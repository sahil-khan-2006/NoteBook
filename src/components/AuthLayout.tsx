import Link from "next/link";
import { Crest } from "@/components/ui";

export function AuthAside({ caption }: { caption: string }) {
  return (
    <div className="relative hidden overflow-hidden bg-rail lg:block lg:w-[46%]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/campus.jpg"
        alt="The engineering department block at B.P. Mandal College of Engineering in late afternoon light"
        className="absolute inset-0 h-full w-full object-cover object-center opacity-70"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(175deg, rgba(16,20,37,.72) 0%, rgba(27,77,219,.42) 46%, rgba(16,20,37,.92) 100%)",
        }}
      />
      <div className="relative flex h-full flex-col justify-between p-10 xl:p-12">
        <div className="flex items-center gap-3">
          <Crest className="h-12 w-12" />
          <div>
            <p className="font-display text-xl font-extrabold leading-tight tracking-tight text-white">
              NoteBook
            </p>
            <p className="text-[13px] leading-tight text-white/70">
              Academic Resource Platform
            </p>
          </div>
        </div>

        <div>
          <p className="tblock text-white/60">Learn · Share · Grow</p>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,4.6vw,3.6rem)] font-extrabold leading-[0.98] tracking-tight text-white">
            The notes you need,
            <br />
            from the desk next
            <br />
            <span className="text-white/55">to yours.</span>
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/75">
            {caption}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-4 border-t border-white/20 pt-6">
          {[
            ["12+", "resource types"],
            ["8", "semesters covered"],
            ["24/7", "peer answers"],
          ].map(([n, l]) => (
            <div key={l}>
              <dt className="num text-2xl font-semibold text-white">{n}</dt>
              <dd className="tblock mt-1 text-white/55">{l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  caption,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  caption: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <AuthAside caption={caption} />
      <div className="flex w-full flex-col lg:w-[54%]">
        <div className="flex items-center gap-3 px-6 pt-6 lg:hidden">
          <Crest className="h-10 w-10" />
          <div>
            <p className="font-display text-[17px] font-extrabold leading-tight text-ink">
              NoteBook <span className="font-medium text-blue text-sm">Academic Hub</span>
            </p>
            <p className="tblock leading-tight">Learn · Share · Grow</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
          <div className="w-full max-w-md">
            <Link href="/" className="tblock hidden items-center gap-2 lg:inline-flex">
              ← Back to home
            </Link>
            <h2 className="mt-3 font-display text-[30px] font-extrabold leading-tight tracking-tight text-ink">
              {title}
            </h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-slate">{subtitle}</p>
            <div className="mt-7">{children}</div>
            <div className="mt-6 text-[13.5px] text-slate">{footer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
