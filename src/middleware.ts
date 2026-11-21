import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

const PUBLIC_PAGES = ["/login", "/setup", "/i/"];
const PUBLIC_API = ["/api/auth/login", "/api/setup", "/api/webhooks/", "/api/public/", "/api/health"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  if ((isApi ? PUBLIC_API : PUBLIC_PAGES).some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  if (isApi) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname + req.nextUrl.search)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/|manifest.webmanifest|robots.txt).*)"],
};
