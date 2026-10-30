import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isPlatformHost } from "@/lib/config";

// Every request on a creator host (<slug>.<root> or a custom domain) is rewritten to
// /sites/<host>/..., where the site layout resolves the tenant. Platform hosts serve
// the landing page and studio, and can't reach /sites directly.
export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase();
  const { pathname, search } = req.nextUrl;

  if (isPlatformHost(host)) {
    if (pathname === "/sites" || pathname.startsWith("/sites/")) {
      return new NextResponse("Not found", { status: 404 });
    }
    // Fast path for signed-out visitors. The real session and ownership checks run on the server.
    const isStudioPage = pathname.startsWith("/studio") && req.method === "GET";
    if (isStudioPage && !req.cookies.has(SESSION_COOKIE)) {
      const login = req.nextUrl.clone();
      login.pathname = "/login";
      login.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(login);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/studio")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const url = req.nextUrl.clone();
  url.pathname = `/sites/${encodeURIComponent(host)}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals and static files.
  matcher: ["/((?!_next/|api/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
