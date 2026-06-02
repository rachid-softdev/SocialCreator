import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { addVersionHeaders, resolveApiVersion } from "@/lib/api-version";
import { auth } from "@/lib/auth";

export default auth(async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API version resolution
  // If the path already has a version prefix (e.g., /api/v1/content), just add headers.
  // If the path is a bare /api/* route and the client sent an Accept-version header,
  // rewrite to the versioned path. Otherwise pass through.
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) {
    const { version, resolvedBy } = resolveApiVersion(pathname, req.headers);

    if (resolvedBy === "url") {
      // Already a versioned path — just add response headers
      const response = NextResponse.next();
      addVersionHeaders(response, version);
      return response;
    }

    if (resolvedBy === "header") {
      // Rewrite to versioned path so old /api/agents becomes /api/v1/agents
      // Only rewrite on explicit Accept-version header to avoid breaking unmigrated routes
      const newUrl = new URL(req.url);
      newUrl.pathname = `/api/${version}${pathname.replace(/^\/api/, "")}`;
      const response = NextResponse.rewrite(newUrl);
      addVersionHeaders(response, version);
      return response;
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
