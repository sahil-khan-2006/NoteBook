"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Award } from "lucide-react";
import { AuthShell } from "@/components/AuthLayout";
import { Button } from "@/components/ui";
import { api } from "@/lib/client";
import { BRANCHES, SEMESTERS, ADMISSION_YEARS } from "@/lib/constants";

const INPUT =
  "w-full rounded-xl border border-line bg-card px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none transition-colors";
const LABEL = "block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted";

const PROFESSOR_DESIGNATIONS = [
  "Professor",
  "Associate Professor",
  "Assistant Professor",
  "Head of Department (HOD)",
  "Visiting Faculty",
  "Lecturer",
];

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "professor">("student");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    rollNumber: "",
    branch: BRANCHES[0] as string,
    semester: 3,
    admissionYear: 2024,
    designation: PROFESSOR_DESIGNATIONS[0],
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.fullName.trim().length < 3) return setError("Please enter your full name.");
    if (!form.email || !form.email.includes("@")) return setError("Please enter a valid email address.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirmPassword) return setError("Passwords do not match.");
    if (!form.rollNumber.trim()) {
      return setError(
        role === "professor"
          ? "Please provide your Faculty / Employee ID."
          : "Please provide your Roll Number.",
      );
    }

    setBusy(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        json: {
          ...form,
          role,
          rollNumber: form.rollNumber.trim(),
        },
      });
      router.replace("/home");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Join NoteBook"
      subtitle={
        role === "student"
          ? "Create a student account to share resources, request material, and build your study streak."
          : "Create a verified faculty account to publish course notes, syllabus, and guide students."
      }
      caption="NoteBook is the collaborative academic space where students and professors learn, share, and grow together."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-blue hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {/* Account Type Selector: Two distinct options */}
      <div className="mb-6">
        <label className={LABEL}>Choose Account Type</label>
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-paper p-1.5 border border-line">
          <button
            type="button"
            onClick={() => {
              setRole("student");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs sm:text-sm font-semibold transition-all ${
              role === "student"
                ? "bg-blue text-white shadow-sm"
                : "text-slate hover:text-ink hover:bg-wash"
            }`}
          >
            <GraduationCap size={17} />
            <span>Student</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRole("professor");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 px-3 text-xs sm:text-sm font-semibold transition-all ${
              role === "professor"
                ? "bg-violet text-white shadow-sm"
                : "text-slate hover:text-ink hover:bg-wash"
            }`}
          >
            <Award size={17} />
            <span>Professor / Faculty</span>
          </button>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={LABEL} htmlFor="r-name">
            {role === "professor" ? "Full Name (e.g. Dr. / Prof. …)" : "Full Name"}
          </label>
          <input
            id="r-name"
            className={`${INPUT} mt-1.5`}
            placeholder={role === "professor" ? "Dr. Amit Verma" : "Rahul Sharma"}
            value={form.fullName}
            onChange={set("fullName")}
            autoComplete="name"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="r-email">
              {role === "professor" ? "Academic / College Email" : "College Email"}
            </label>
            <input
              id="r-email"
              type="email"
              className={`${INPUT} mt-1.5`}
              placeholder={role === "professor" ? "prof.verma@college.edu" : "student@college.edu"}
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="r-roll">
              {role === "professor" ? "Faculty / Employee ID" : "Roll Number"}
            </label>
            <input
              id="r-roll"
              className={`${INPUT} mt-1.5`}
              placeholder={role === "professor" ? "FAC-2023-42" : "22BCE1001"}
              value={form.rollNumber}
              onChange={set("rollNumber")}
            />
          </div>
        </div>

        {role === "student" ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={LABEL} htmlFor="r-branch">Branch</label>
              <select
                id="r-branch"
                className={`${INPUT} mt-1.5`}
                value={form.branch}
                onChange={set("branch")}
              >
                {BRANCHES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="r-sem">Semester</label>
              <select
                id="r-sem"
                className={`${INPUT} mt-1.5`}
                value={form.semester}
                onChange={set("semester")}
              >
                {SEMESTERS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="r-year">Admission Year</label>
              <select
                id="r-year"
                className={`${INPUT} mt-1.5`}
                value={form.admissionYear}
                onChange={set("admissionYear")}
              >
                {ADMISSION_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="r-prof-dept">Department / Branch</label>
              <select
                id="r-prof-dept"
                className={`${INPUT} mt-1.5`}
                value={form.branch}
                onChange={set("branch")}
              >
                {BRANCHES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="r-designation">Designation</label>
              <select
                id="r-designation"
                className={`${INPUT} mt-1.5`}
                value={form.designation}
                onChange={set("designation")}
              >
                {PROFESSOR_DESIGNATIONS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="r-pass">Password</label>
            <input
              id="r-pass"
              type="password"
              className={`${INPUT} mt-1.5`}
              placeholder="At least 8 characters"
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="r-confirm">Confirm Password</label>
            <input
              id="r-confirm"
              type="password"
              className={`${INPUT} mt-1.5`}
              placeholder="Repeat your password"
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              autoComplete="new-password"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-flamewash px-3.5 py-2.5 text-[13px] text-flame">
            {error}
          </p>
        )}

        <Button
          type="submit"
          loading={busy}
          disabled={busy}
          variant={role === "professor" ? "violet" : "primary"}
          className="w-full !py-3 font-semibold"
        >
          {role === "professor" ? "Create Professor Account" : "Create Student Account"}
        </Button>

        <p className="text-[11.5px] leading-relaxed text-muted text-center">
          By registering, your account will be activated on NoteBook with verified access to department course material.
        </p>
      </form>
    </AuthShell>
  );
}
