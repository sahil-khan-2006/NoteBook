import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = [
  "/home",
  "/explore",
  "/notifications",
  "/saved",
  "/profile",
  "/resource",
  "/leaderboard",
  "/create",
  "/admin",
  "/settings",
];

/** Structural check — the signature is verified server-side in lib/auth. */
function looksValid(token?: string) {
  if (!token) return false;
  const [body] = token.split(".");
  if (!body) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return Boolean(payload.uid) && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("bpm_session")?.value;
  const authed = looksValid(token);

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if ((pathname === "/login" || pathname === "/register") && authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/home";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (pathname === "/admin" && authed) {
    // role gate is enforced again in the API; UI gate happens client-side
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|images).*)"],
};
