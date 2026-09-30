import { createHash } from "node:crypto"
import type { Prisma } from "@prisma/client"
import prisma from "@/lib/prisma"

export class RegistrationError extends Error {
  constructor(public code: "registrationClosed" | "invalidInvite") {
    super(code)
  }
}

export function hashInvite(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex")
}

export async function getRegistrationMode() {
  const settings = await prisma.registrationSettings.findUnique({ where: { id: "global" } })
  return settings?.mode ?? "OPEN"
}

// Serialize signup and mode changes so a closed registration cannot race a signup.
// ponytail: one global signup lock; use shared/exclusive locks if signup throughput requires it.
export async function lockRegistrationSettings(tx: Prisma.TransactionClient) {
  return tx.registrationSettings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: { id: "global" },
  })
}

export async function createRegisteredUser(data: Prisma.UserCreateInput, inviteCode?: string) {
  return prisma.$transaction(async (tx) => {
    const { mode } = await lockRegistrationSettings(tx)
    if (mode === "CLOSED") throw new RegistrationError("registrationClosed")
    if (mode === "INVITE_ONLY") {
      if (!inviteCode) throw new RegistrationError("invalidInvite")
      const now = new Date()
      const claimed = await tx.registrationInvite.updateMany({
        where: { codeHash: hashInvite(inviteCode), usedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      })
      if (claimed.count !== 1) throw new RegistrationError("invalidInvite")
    }
    // The settings lock also makes concurrent first signups elect exactly one owner.
    const isOwner = !await tx.user.findFirst({ select: { id: true } })
    // The invite claim rolls back if user creation fails.
    return tx.user.create({ data: { ...data, isAdmin: isOwner, isOwner } })
  })
}
