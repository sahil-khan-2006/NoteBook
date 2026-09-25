"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthLayout";
import { Button } from "@/components/ui";
import { api } from "@/lib/client";

const INPUT =
  "w-full rounded-xl border border-line bg-card px-3.5 py-3 text-sm text-ink placeholder:text-muted focus:border-blue focus:outline-none transition-colors";

export default function ForgotPage() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const res = await api<{ token: string | null; message: string }>(
        "/api/auth/forgot",
        {
          method: "POST",
          json:
            step === "request"
              ? { step: "request", email }
              : { step: "reset", token, newPassword: password },
        },
      );
      if (step === "request") {
        setMessage(res.message);
        if (res.token) {
          setToken(res.token);
          setStep("reset");
        }
      } else {
        setMessage(`${res.message} Head to the sign-in page.`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We issue a single-use reset token valid for fifteen minutes."
      caption="Account recovery for the Academic Hub. Your resources, saves and streak are untouched."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-semibold text-blue hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {step === "request" ? (
          <div>
            <label htmlFor="f-email" className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
              College email
            </label>
            <input
              id="f-email"
              type="email"
              className={`${INPUT} mt-1.5`}
              placeholder="you@bpmandal.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="f-token" className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
                Reset token
              </label>
              <input id="f-token" className={`${INPUT} mt-1.5 num`} value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
            <div>
              <label htmlFor="f-pass" className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">
                New password
              </label>
              <input
                id="f-pass"
                type="password"
                className={`${INPUT} mt-1.5`}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </>
        )}

        {message && (
          <p className="rounded-lg bg-wash px-3.5 py-2.5 text-[13px] text-blue">{message}</p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-flamewash px-3.5 py-2.5 text-[13px] text-flame">
            {error}
          </p>
        )}

        <Button type="submit" loading={busy} disabled={busy} className="w-full !py-3">
          {step === "request" ? "Send reset link" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}
