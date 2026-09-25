import { destroySession } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

export const runtime = "nodejs";

export async function POST() {
  return handler(async () => {
    await destroySession();
    return ok({ ok: true });
  });
}
