import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { generateShortCode } from '@/lib/shortcode'

type Context = { params: Promise<{ id: string }> }
const fail = (status: number) => NextResponse.json({ error: 'templateFailed' }, { status })

export async function PATCH(request: NextRequest, { params }: Context) {
  const ownerId = (await auth())?.user?.id
  if (!ownerId) return fail(401)
  const parsed = z.object({ isTemplate: z.boolean() }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail(400)
  const changed = await prisma.project.updateMany({ where: { id: (await params).id, ownerId }, data: parsed.data })
  return changed.count ? NextResponse.json({ ok: true }) : fail(404)
}

export async function POST(request: NextRequest, { params }: Context) {
  const ownerId = (await auth())?.user?.id
  if (!ownerId) return fail(401)
  const parsed = z.object({ name: z.string().trim().min(1).max(100), date: z.iso.date(), zone: z.string().min(1).max(100) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail(400)
  const { name, date, zone } = parsed.data
  try { new Intl.DateTimeFormat('en', { timeZone: zone }) } catch { return fail(400) }
  const { id } = await params
  return prisma.$transaction(async tx => {
    const source = await tx.project.findFirst({ where: { id, ownerId, isTemplate: true }, include: {
      moodboardLinks: { where: { group: { ownerId } }, select: { groupId: true, order: true } },
      contracts: { where: { signatures: { none: {} } }, select: { title: true, content: true } },
      callsheet: { include: { scheduleItems: true } },
    } })
    if (!source) return fail(404)
    const sheet = source.callsheet
    const stamps = sheet ? [sheet.callTime, sheet.startTime, sheet.endTime, sheet.wrapTime, ...sheet.scheduleItems.map(i => i.time)].filter((v): v is Date => !!v) : []
    // Shift calendar days in the photographer's zone so a 09:00 call stays at 09:00 across DST.
    const sourceDay = source.date?.toISOString().slice(0, 10) ?? null
    const shifted = stamps.length ? await tx.$queryRaw<{ original: string; shifted: Date }[]>`
      WITH times AS (SELECT value AS original, value::timestamptz AT TIME ZONE ${zone} AS local FROM jsonb_array_elements_text(${JSON.stringify(stamps)}::jsonb))
      SELECT original, (local + interval '1 day' * (CAST(${date} AS date) - coalesce(CAST(${sourceDay} AS date), min(local::date) OVER ()))) AT TIME ZONE ${zone} AS shifted FROM times` : []
    const dates = new Map(shifted.map(r => [r.original, r.shifted]))
    const shift = (value: Date | null) => value ? dates.get(value.toISOString())! : null
    const project = await tx.project.create({ data: {
      name, date: new Date(date), ownerId, shortCode: generateShortCode(), location: source.location, address: source.address,
      galleryLayout: source.galleryLayout, brandingColor: source.brandingColor, selectionTarget: source.selectionTarget,
      showSelectionFolders: source.showSelectionFolders, allowSelectionDownload: source.allowSelectionDownload, allowGuestSelection: source.allowGuestSelection,
      showMoodboardPublicly: source.showMoodboardPublicly, showParticipantsPublicly: source.showParticipantsPublicly, showContractsPublicly: source.showContractsPublicly,
      showSelectionPublicly: source.showSelectionPublicly, showCallsheetPublicly: source.showCallsheetPublicly, showResultsPublicly: source.showResultsPublicly,
      showAppointmentsPublicly: source.showAppointmentsPublicly, allowApplications: source.allowApplications, allowAppointments: source.allowAppointments,
      moodboardLinks: { create: source.moodboardLinks }, contracts: { create: source.contracts },
      callsheet: sheet ? { create: { locationName: sheet.locationName, locationAddress: sheet.locationAddress, locationNotes: sheet.locationNotes,
        parkingInfo: sheet.parkingInfo, dresscode: sheet.dresscode, equipmentList: sheet.equipmentList, additionalNotes: sheet.additionalNotes,
        callTime: shift(sheet.callTime), startTime: shift(sheet.startTime), endTime: shift(sheet.endTime), wrapTime: shift(sheet.wrapTime),
        scheduleItems: { create: sheet.scheduleItems.map(i => ({ time: shift(i.time)!, activity: i.activity, duration: i.duration, notes: i.notes, order: i.order })) },
      } } : undefined,
    }, select: { id: true } })
    return NextResponse.json(project, { status: 201 })
  }, { isolationLevel: 'RepeatableRead' })
}
