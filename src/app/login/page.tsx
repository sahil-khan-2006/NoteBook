"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthLayout";
import { Button } from "@/components/ui";
import { api } from "@/lib/client";

const INPUT =
  "w-full rounded-xl border border-line bg-card px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none transition-colors";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", remember: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.email || !form.password) return setError("Enter your email and password.");
    setBusy(true);
    try {
      await api("/api/auth/login", { method: "POST", json: form });
      router.replace("/home");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your college address to pick up your feed, streak and saved resources."
      caption="Sign in to see what your batch has shared today — unit notes, previous year papers, lab manuals and open requests from your branch."
      footer={
        <>
          New to the hub?{" "}
          <Link href="/register" className="font-semibold text-blue hover:underline">
            Create your account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
            College email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`${INPUT} mt-1.5`}
            placeholder="arshan.rahman@bpmandal.ac.in"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
              Password
            </label>
            <Link href="/forgot" className="text-[12.5px] font-medium text-blue hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={`${INPUT} mt-1.5`}
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-slate">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(e) => setForm({ ...form, remember: e.target.checked })}
            className="h-4 w-4 accent-[var(--blue)]"
          />
          Keep me signed in on this device
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-flamewash px-3.5 py-2.5 text-[13px] text-flame">
            {error}
          </p>
        )}

        <Button type="submit" loading={busy} disabled={busy} className="w-full !py-3">
          Sign in
        </Button>
      </form>

      <div className="mt-5 rounded-xl border border-line bg-card p-4">
        <p className="tblock">Demo accounts</p>
        <ul className="mt-2 space-y-1.5 text-[13px] text-slate">
          <li>
            <span className="font-semibold text-ink">arshan@hub.dev</span> ·{" "}
            <span className="num">demo1234</span> — student
          </li>
          <li>
            <span className="font-semibold text-ink">admin@bpmandal.ac.in</span> ·{" "}
            <span className="num">admin1234</span> — administrator
          </li>
        </ul>
      </div>
    </AuthShell>
  );
}
