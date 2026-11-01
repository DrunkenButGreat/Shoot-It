import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { NextRequest, NextFetchEvent } from "next/server"

const authenticatedProxy = auth((req, _event: NextFetchEvent) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/login", "/signup", "/api/health", "/api/auth/register"]
  const isPublicRoute = publicRoutes.some(route => pathname === route || (route !== "/" && pathname.startsWith(`${route}/`)))

  const isPublicAsset = pathname.startsWith("/images/") || pathname === "/robots.txt"

  // Public short URLs (e.g., /p/abc12345)
  const isPublicShortUrl = pathname.startsWith("/p/")

  // API routes are handled separately
  const isApiRoute = pathname.startsWith("/api/")

  if (isPublicRoute || isPublicAsset || isPublicShortUrl) {
    return NextResponse.next()
  }

  if (!isLoggedIn && !isApiRoute) {
    const url = new URL("/login", req.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

// Auth.js lazy configuration returns its wrapper asynchronously.
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  return (await authenticatedProxy)(request, event)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
