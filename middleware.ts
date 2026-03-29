import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  // Public routes
  const publicRoutes = ["/", "/login", "/magic-link", "/verify", "/apply"];
  const isPublicRoute = publicRoutes.some((route) => pathname === route);
  const isApiAuth = pathname.startsWith("/api/auth");
  const isApiPublic =
    pathname.startsWith("/api/magic-link") ||
    (pathname === "/api/applications" && req.method === "POST");

  const isWebhook = pathname.startsWith("/api/webhook/chatcenter");

  if (isPublicRoute || isApiAuth || isApiPublic || isWebhook) {
    // Redirect authenticated users away from auth pages to chat
    if (isLoggedIn && (pathname === "/login" || pathname === "/magic-link" || pathname === "/")) {
      if (userRole === "admin") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      return NextResponse.redirect(new URL("/chat", req.url));
    }
    return NextResponse.next();
  }

  // Protected: /chat routes
  if (pathname.startsWith("/chat")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  }

  // Protected: /admin routes
  if (pathname.startsWith("/admin")) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (userRole !== "admin") {
      return NextResponse.redirect(new URL("/chat", req.url));
    }
    return NextResponse.next();
  }

  // API routes - require authentication by default
  if (pathname.startsWith("/api/")) {
    if (!isLoggedIn) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const runtime = "nodejs";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|icons|.*\\.png$).*)",
  ],
};
