import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";

const DEVICE_COOKIE = "notevault_device";
const ONE_YEAR = 60 * 60 * 24 * 365;

// Optimistic check only: redirects unauthenticated visitors away from /admin.
// The real authorization check happens server-side in the admin layout via getSession().
export function middleware(request: NextRequest) {

  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();
    const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
    if (!hasSession) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    // Only Subject Notes, the Papers archive editor (+ Settings, which the notes-featured-programmes
    // picker lives on) work for now — every other admin section (Bulk
    // Upload, Programs, Master Syllabus, the /admin overview itself, etc.)
    // is parked until it's actually needed again, so all of them —
    // including the bare /admin root — send straight to Subject Notes
    // rather than a dashboard full of now-dead links.
    const ADMIN_ALLOWED_PREFIXES = ["/admin/subject-notes", "/admin/papers-archive", "/admin/features", "/admin/settings"];
    const isAllowed = ADMIN_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isAllowed) {
      return NextResponse.redirect(new URL("/admin/subject-notes", request.url));
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
