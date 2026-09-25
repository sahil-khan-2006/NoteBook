"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/AuthLayout";
import { Button } from "@/components/ui";
import { api } from "@/lib/client";
import { BRANCHES, SEMESTERS, ADMISSION_YEARS } from "@/lib/constants";

const INPUT =
  "w-full rounded-xl border border-line bg-card px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none transition-colors";
const LABEL = "block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    rollNumber: "",
    branch: BRANCHES[0] as string,
    semester: 3,
    admissionYear: 2024,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await api("/api/auth/register", { method: "POST", json: form });
      router.replace("/home");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Join the Academic Hub"
      subtitle="One account per student. Your roll number keeps the leaderboard and streaks honest."
      caption="Register once with your roll number, branch and semester — then publish your first resource and start your streak."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-blue hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={LABEL} htmlFor="r-name">Full name</label>
          <input id="r-name" className={`${INPUT} mt-1.5`} placeholder="Arshan Rahman" value={form.fullName} onChange={set("fullName")} autoComplete="name" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="r-email">College email</label>
            <input id="r-email" type="email" className={`${INPUT} mt-1.5`} placeholder="you@bpmandal.ac.in" value={form.email} onChange={set("email")} autoComplete="email" />
          </div>
          <div>
            <label className={LABEL} htmlFor="r-roll">Roll number</label>
            <input id="r-roll" className={`${INPUT} mt-1.5`} placeholder="BCO22017" value={form.rollNumber} onChange={set("rollNumber")} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={LABEL} htmlFor="r-branch">Branch</label>
            <select id="r-branch" className={`${INPUT} mt-1.5`} value={form.branch} onChange={set("branch")}>
              {BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="r-sem">Semester</label>
            <select id="r-sem" className={`${INPUT} mt-1.5`} value={form.semester} onChange={set("semester")}>
              {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="r-year">Admission year</label>
            <select id="r-year" className={`${INPUT} mt-1.5`} value={form.admissionYear} onChange={set("admissionYear")}>
              {ADMISSION_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="r-pass">Password</label>
            <input id="r-pass" type="password" className={`${INPUT} mt-1.5`} placeholder="At least 8 characters" value={form.password} onChange={set("password")} autoComplete="new-password" />
          </div>
          <div>
            <label className={LABEL} htmlFor="r-confirm">Confirm password</label>
            <input id="r-confirm" type="password" className={`${INPUT} mt-1.5`} placeholder="Repeat it" value={form.confirmPassword} onChange={set("confirmPassword")} autoComplete="new-password" />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-flamewash px-3.5 py-2.5 text-[13px] text-flame">
            {error}
          </p>
        )}

        <Button type="submit" loading={busy} disabled={busy} className="w-full !py-3">
          Create account
        </Button>
        <p className="text-[11.5px] leading-relaxed text-muted">
          Passwords are hashed with scrypt and a per-deployment pepper. Sessions are
          HMAC-signed and httpOnly. When your college mail system is connected, this
          form switches to college-domain verification automatically.
        </p>
      </form>
    </AuthShell>
  );
}
