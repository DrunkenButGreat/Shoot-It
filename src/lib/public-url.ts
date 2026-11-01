import prisma from "@/lib/prisma"

export async function getPublicUrl() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: "global" }, select: { publicUrl: true } })
  const value = settings?.publicUrl || process.env.AUTH_URL || process.env.NEXTAUTH_URL
  return value ? new URL(value).origin : ""
}

export function validSettingsOrigin(request: Request, publicUrl: string) {
  const origin = request.headers.get("origin")
  if (!origin || origin === "null") return false
  // Browser-owned Fetch Metadata permits first-time setup behind a misconfigured proxy.
  const site = request.headers.get("sec-fetch-site")
  if (site === "same-origin") return true
  if (site && site !== "none") return false
  return origin === (publicUrl || new URL(request.url).origin)
}
