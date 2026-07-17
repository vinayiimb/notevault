import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

const DEVICE_COOKIE = "notevault_device";
const ONE_YEAR = 60 * 60 * 24 * 365;

// Optimistic check only: redirects unauthenticated visitors away from /admin.
// The real authorization check happens server-side in the admin layout via getSession().
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
    if (!hasSession) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  // Anonymous per-browser identity for the student gamification mechanic
  // (streak / oranges / leaderboard) — no login. Cookie writes are only
  // legal in middleware/Server Actions/Route Handlers, never in a Server
  // Component render, so it's assigned here rather than on the dashboard
  // page itself. Setting it on both `request.cookies` and the response
  // makes it visible to Server Components during this same request too.
  if (!request.cookies.has(DEVICE_COOKIE)) {
    const deviceId = crypto.randomUUID();
    request.cookies.set(DEVICE_COOKIE, deviceId);
    const response = NextResponse.next({ request });
    response.cookies.set(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR,
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
