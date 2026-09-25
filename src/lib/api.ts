import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps route handlers with uniform auth + error handling. */
export async function handler(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AuthError) return fail(err.status, err.message);
    let message = "Something went wrong";
    if (process.env.NODE_ENV !== "production") {
      const anyErr = err as { message?: string; cause?: { message?: string; code?: string; errors?: Array<{ code?: string }> }; code?: string };
      const isConnRefused =
        anyErr?.code === "ECONNREFUSED" ||
        anyErr?.cause?.code === "ECONNREFUSED" ||
        anyErr?.cause?.errors?.some((e) => e.code === "ECONNREFUSED") ||
        anyErr?.message?.includes("ECONNREFUSED");

      if (isConnRefused) {
        message = "Database connection failed (ECONNREFUSED). Please ensure PostgreSQL is running and DATABASE_URL in .env.local is correct.";
      } else if (anyErr?.cause?.message) {
        message = `${anyErr.message} — Cause: ${anyErr.cause.message}`;
      } else if (err instanceof Error) {
        message = err.message;
      }
    }
    console.error("[api]", err);
    return fail(500, message);
  }
}
