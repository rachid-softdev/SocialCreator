import { auth } from "@/lib/auth";

export default auth;

export function isProtectedRoute(pathname: string): boolean {
  const publicRoutes = ["/login", "/register", "/verify", "/api/auth", "/_next", "/public", "/"];

  // Allow /onboarding/cgu even without auth
  if (pathname === "/onboarding/cgu") {
    return false;
  }

  // Check if pathname starts with any public route prefix
  return !publicRoutes.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname.startsWith(route);
  });
}

export function isAuthRoute(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
}

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
