import { NextResponse } from "next/server"
import { z } from "zod"
import { getAdmin } from "@/lib/admin"
import { getPublicUrl, validSettingsOrigin } from "@/lib/public-url"
import { checkPocketIdDiscovery, getPocketIdSettings, pocketIdInput, PocketIdError, savePocketIdSettings } from "@/lib/pocket-id"

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function GET() {
  if (!await getAdmin()) return json({ error: "forbidden" }, 403)
  return json(await getPocketIdSettings())
}

async function mutate(request: Request, test: boolean) {
  if (!await getAdmin()) return json({ error: "forbidden" }, 403)
  if (!validSettingsOrigin(request, await getPublicUrl())) return json({ error: "invalidOrigin" }, 403)
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return json({ error: "invalidInput" }, 415)
  try {
    const body = await request.json()
    if (test) {
      const { issuer } = z.object({ issuer: z.string().trim().min(1).max(2048) }).parse(body)
      await checkPocketIdDiscovery(issuer)
      return json({ ok: true })
    }
    await savePocketIdSettings(pocketIdInput.parse(body))
    return json(await getPocketIdSettings())
  } catch (error) {
    if (error instanceof PocketIdError) return json({ error: error.code }, 400)
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: "invalidInput" }, 400)
    return json({ error: "errorOccurred" }, 500)
  }
}

export const PATCH = (request: Request) => mutate(request, false)
export const POST = (request: Request) => mutate(request, true)
