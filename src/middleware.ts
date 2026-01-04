import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/login", "/api/health"]
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Public short URLs (e.g., /p/abc12345)
  const isPublicShortUrl = pathname.startsWith("/p/")

  // API routes are handled separately
  const isApiRoute = pathname.startsWith("/api/")

  if (isPublicRoute || isPublicShortUrl) {
    return NextResponse.next()
  }

  if (!isLoggedIn && !isApiRoute) {
    const url = new URL("/login", req.url)
    url.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
