import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto"
import { z } from "zod"
import { createRemoteJWKSet, jwtVerify } from "jose"
import prisma from "@/lib/prisma"
import { lockRegistrationSettings } from "@/lib/registration"

export class PocketIdError extends Error {
  constructor(public code: string) { super(code) }
}

function encryptionKey() {
  if (!process.env.AUTH_SECRET) throw new PocketIdError("secretUnavailable")
  return Buffer.from(hkdfSync("sha256", process.env.AUTH_SECRET, "shoot-it", "pocket-id-client-secret-v1", 32))
}

export function encryptPocketIdSecret(secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()])
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".")
}

export function decryptPocketIdSecret(value: string) {
  try {
    const [version, iv, tag, encrypted, extra] = value.split(".")
    if (version !== "v1" || !iv || !tag || !encrypted || extra) throw new Error()
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8")
  } catch { throw new PocketIdError("secretUnavailable") }
}

export function pocketIdUrl(value: string) {
  let url: URL
  try { url = new URL(value) } catch { throw new PocketIdError("invalidIssuer") }
  const local = process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) {
    throw new PocketIdError("invalidIssuer")
  }
  return url.href.replace(/\/$/, "")
}

export const pocketIdInput = z.object({
  enabled: z.boolean(),
  issuer: z.string().trim().max(2048),
  clientId: z.string().trim().max(512),
  clientSecret: z.string().max(4096).optional(),
})

export async function getPocketIdSettings() {
  const settings = await prisma.pocketIdSettings.findUnique({ where: { id: "global" } })
  return {
    enabled: settings?.enabled ?? false,
    issuer: settings?.issuer ?? "",
    clientId: settings?.clientId ?? "",
    hasClientSecret: !!settings?.clientSecret,
  }
}

export async function getPocketIdConfig() {
  const settings = await prisma.pocketIdSettings.findUnique({ where: { id: "global" } })
  if (!settings?.enabled || !settings.issuer || !settings.clientId || !settings.clientSecret) return null
  try {
    return { ...settings, secret: decryptPocketIdSecret(settings.clientSecret) }
  } catch { return null }
}

export async function savePocketIdSettings(input: z.infer<typeof pocketIdInput>) {
  const issuer = input.issuer ? pocketIdUrl(input.issuer) : ""
  return prisma.$transaction(async tx => {
    const current = await tx.pocketIdSettings.upsert({ where: { id: "global" }, create: { id: "global" }, update: { id: "global" } })
    if (issuer !== current.issuer && await tx.account.findFirst({ where: { provider: "pocket-id" } })) {
      throw new PocketIdError("issuerLocked")
    }
    const clientSecret = input.clientSecret ? encryptPocketIdSecret(input.clientSecret) : current.clientSecret
    if (input.enabled) {
      if (!issuer || !input.clientId || !clientSecret) throw new PocketIdError("incomplete")
      decryptPocketIdSecret(clientSecret)
    }
    await tx.pocketIdSettings.update({ where: { id: "global" }, data: { enabled: input.enabled, issuer, clientId: input.clientId, clientSecret } })
  })
}

export async function checkPocketIdDiscovery(issuerInput: string) {
  const issuer = pocketIdUrl(issuerInput)
  try {
    const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(5000), redirect: "error", cache: "no-store",
      headers: { Accept: "application/json" },
    })
    if (!response.ok) throw new Error()
    const metadata = await response.json()
    if (metadata.issuer !== issuer) throw new Error()
    for (const key of ["authorization_endpoint", "token_endpoint", "userinfo_endpoint", "jwks_uri"]) {
      if (typeof metadata[key] !== "string") throw new Error()
      pocketIdUrl(metadata[key])
    }
    if (!metadata.response_types_supported?.includes("code") || !metadata.code_challenge_methods_supported?.includes("S256")) throw new Error()
    return metadata
  } catch { throw new PocketIdError("discoveryFailed") }
}

export async function verifyPocketIdToken(token: string | undefined, config: NonNullable<Awaited<ReturnType<typeof getPocketIdConfig>>>) {
  if (!token) throw new PocketIdError("errorOccurred")
  const metadata = await checkPocketIdDiscovery(config.issuer)
  const { payload } = await jwtVerify(token, createRemoteJWKSet(new URL(metadata.jwks_uri), { timeoutDuration: 5000 }), {
    issuer: config.issuer, audience: config.clientId,
    algorithms: ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA"],
    requiredClaims: ["sub", "iat", "exp"],
  })
  return payload
}

const profileSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.string().trim().email().max(320),
  email_verified: z.literal(true),
  name: z.string().max(512).optional(),
  picture: z.string().url().max(2048).optional(),
})

// Called only after Auth.js has verified the OIDC response, never from a public signup API.
export async function provisionPocketIdAccount(profile: unknown, config: NonNullable<Awaited<ReturnType<typeof getPocketIdConfig>>>) {
  const parsed = profileSchema.safeParse(profile)
  if (!parsed.success) throw new PocketIdError("unverifiedEmail")
  const identity = parsed.data
  return prisma.$transaction(async tx => {
    // Share the signup lock with local registration; serialize linking and issuer changes too.
    await lockRegistrationSettings(tx)
    const current = await tx.pocketIdSettings.upsert({ where: { id: "global" }, create: { id: "global" }, update: { id: "global" } })
    if (!current.enabled || current.issuer !== config.issuer || current.clientId !== config.clientId || current.clientSecret !== config.clientSecret) {
      throw new PocketIdError("configurationChanged")
    }
    const linked = await tx.account.findUnique({ where: { provider_providerAccountId: { provider: "pocket-id", providerAccountId: identity.sub } }, include: { user: true } })
    if (linked) return linked.user
    const matches = await tx.user.findMany({ where: { email: { equals: identity.email, mode: "insensitive" } }, take: 2 })
    if (matches.length > 1) throw new PocketIdError("accountConflict")
    let user = matches[0]
    if (user && await tx.account.findFirst({ where: { userId: user.id, provider: "pocket-id" } })) throw new PocketIdError("accountConflict")
    if (!user) {
      user = await tx.user.create({ data: { email: identity.email, name: identity.name, image: identity.picture, emailVerified: new Date(), isAdmin: false, isOwner: false } })
      await tx.participant.updateMany({ where: { email: identity.email, userId: null }, data: { userId: user.id } })
    }
    await tx.account.create({ data: { userId: user.id, provider: "pocket-id", providerAccountId: identity.sub, type: "oidc" } })
    return user
  })
}
