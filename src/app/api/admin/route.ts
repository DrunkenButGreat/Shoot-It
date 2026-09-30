import { randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getAdmin } from "@/lib/admin"
import prisma from "@/lib/prisma"
import { hashInvite, lockRegistrationSettings } from "@/lib/registration"

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mode"), mode: z.enum(["OPEN", "CLOSED", "INVITE_ONLY"]) }),
  z.object({ action: z.literal("invite"), days: z.number().int().min(1).max(90) }),
  z.object({ action: z.literal("revoke"), id: z.string().min(1).max(100) }),
])

export async function POST(request: NextRequest) {
  try {
    if (!await getAdmin()) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    // Only JSON mutations; cross-site forms cannot submit this content type.
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return NextResponse.json({ error: "invalidInput" }, { status: 415 })
    }
    const input = actionSchema.parse(await request.json())
    if (input.action === "mode") {
      await prisma.$transaction(async (tx) => {
        await lockRegistrationSettings(tx)
        await tx.registrationSettings.update({ where: { id: "global" }, data: { mode: input.mode } })
      })
    } else if (input.action === "invite") {
      const code = randomBytes(24).toString("base64url")
      await prisma.registrationInvite.create({
        data: { codeHash: hashInvite(code), expiresAt: new Date(Date.now() + input.days * 86_400_000) },
      })
      return NextResponse.json({ code }, { status: 201, headers: { "Cache-Control": "no-store" } })
    } else {
      await prisma.registrationInvite.updateMany({
        where: { id: input.id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalidInput" }, { status: 400 })
    }
    console.error("Admin update failed")
    return NextResponse.json({ error: "errorOccurred" }, { status: 500 })
  }
}
