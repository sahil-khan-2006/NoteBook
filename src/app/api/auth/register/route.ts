import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, streaks, subjects, userSubjects } from "@/db/schema";
import { hashPassword, cleanText, rateLimit } from "@/lib/security";
import { createSession, clientKey } from "@/lib/auth";
import { handler, ok, fail } from "@/lib/api";
import { BRANCHES, SEMESTERS, ADMISSION_YEARS, DEFAULT_SUBJECTS } from "@/lib/constants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handler(async () => {
    const key = await clientKey("register");
    if (!rateLimit(key, 8, 60_000))
      return fail(429, "Too many attempts. Please wait a minute.");

    const body = await req.json().catch(() => ({}));
    const fullName = cleanText(body.fullName, 120);
    const email = cleanText(body.email, 160).toLowerCase();
    const rollNumber = cleanText(body.rollNumber, 40).toUpperCase();
    const branch = cleanText(body.branch, 48);
    const password = String(body.password ?? "");
    const confirm = String(body.confirmPassword ?? "");
    const semester = Number(body.semester);
    const admissionYear = Number(body.admissionYear);

    if (fullName.length < 3) return fail(400, "Please enter your full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      return fail(400, "Please enter a valid email address.");
    if (!rollNumber || rollNumber.length < 3)
      return fail(400, "Please enter your roll number.");
    if (!(BRANCHES as readonly string[]).includes(branch))
      return fail(400, "Please select a valid branch.");
    if (!(SEMESTERS as readonly number[]).includes(semester))
      return fail(400, "Please select a semester.");
    if (!(ADMISSION_YEARS as readonly number[]).includes(admissionYear))
      return fail(400, "Please select your admission year.");
    if (password.length < 8) return fail(400, "Password must be at least 8 characters.");
    if (password !== confirm) return fail(400, "Passwords do not match.");

    // Reserved hook for official college-mail verification: when COLLEGE_EMAIL_DOMAINS
    // is set (e.g. "bpmandal.ac.in"), only those domains may register.
    const allowed = (process.env.COLLEGE_EMAIL_DOMAINS ?? "")
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length && !allowed.some((d) => email.endsWith(`@${d}`)))
      return fail(403, `Registration is restricted to ${allowed.join(", ")} accounts.`);

    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existingEmail.length) return fail(409, "An account with this email already exists.");

    const existingRoll = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.rollNumber, rollNumber))
      .limit(1);
    if (existingRoll.length) return fail(409, "An account with this roll number already exists.");

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(users)
      .values({
        fullName,
        email,
        passwordHash,
        rollNumber,
        branch,
        semester,
        admissionYear,
        bio: `${branch} • ${semester}${["st","nd","rd"][semester-1] ?? "th"} semester student at B.P. Mandal College of Engineering, Madhepura.`,
      })
      .returning({ id: users.id });

    await db.insert(streaks).values({ userId: user.id, current: 0, highest: 0 });

    // seed a starter subject set so the For You feed has signal from day one
    const seeded = await db.select().from(subjects).limit(50);
    const chosen = seeded
      .filter((s) => DEFAULT_SUBJECTS.includes(s.name))
      .slice(0, 4)
      .map((s) => ({ userId: user.id, subjectId: s.id }));
    if (chosen.length) await db.insert(userSubjects).values(chosen).onConflictDoNothing();

    await createSession(user.id, true);
    return ok({ id: user.id });
  });
}
