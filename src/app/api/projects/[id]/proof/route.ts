import { createHash, randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessProject, canEditProject } from '@/lib/permissions'

const key = z.string().min(1).max(128)
const action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pick'), imageId: key, value: z.boolean() }),
  z.object({ action: z.literal('note'), imageId: key, text: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal('submit'), name: z.string().trim().max(100).optional() }),
  z.object({ action: z.literal('reopen'), listId: key }),
  z.object({ action: z.literal('resolve'), noteId: key, done: z.boolean() }),
  z.object({ action: z.literal('settings'), target: z.number().int().min(1).max(100000).nullable(), due: z.iso.date().nullable() }),
])
const listSelect = { id: true, name: true, submittedAt: true, picks: { select: { imageId: true } }, notes: {
  orderBy: { createdAt: 'asc' as const }, select: { id: true, imageId: true, text: true, done: true },
} }
const fail = (error: string, status: number) => NextResponse.json({ error }, { status })

async function access(request: NextRequest, id: string) {
  const user = (await auth())?.user
  const member = user?.id && await canAccessProject(user.id, id)
  const project = await prisma.project.findUnique({ where: { id }, select: {
    isPublic: true, showSelectionPublicly: true, allowGuestSelection: true, selectionTarget: true, selectionDue: true,
  } })
  if (!project || (!member && !(project.isPublic && project.showSelectionPublicly && project.allowGuestSelection))) return null
  const cookieName = 'shootit_proof'
  const existing = request.cookies.get(cookieName)?.value
  const token = existing && z.uuid().safeParse(existing).success ? existing : randomUUID()
  return { project, actor: member ? `user:${user!.id}` : `guest:${createHash('sha256').update(token).digest('hex')}`,
    name: member ? user!.name || user!.email || '' : '', editor: !!(member && await canEditProject(user!.id!, id)),
    newCookie: !member && token !== existing ? { name: cookieName, value: token } : null }
}

type Context = { params: Promise<{ id: string }> }
export async function GET(request: NextRequest, context: Context) {
  const { id } = await context.params
  const viewer = await access(request, id)
  if (!viewer) return fail('denied', 403)
  const mine = await prisma.proofList.findUnique({ where: { projectId_actor: { projectId: id, actor: viewer.actor } }, select: listSelect })
  const lists = viewer.editor ? await prisma.proofList.findMany({ where: { projectId: id }, select: listSelect, orderBy: { id: 'asc' } }) : []
  const response = NextResponse.json({ mine, lists, editor: viewer.editor, guest: viewer.actor.startsWith('guest:'),
    target: viewer.project.selectionTarget, due: viewer.project.selectionDue?.toISOString().slice(0, 10) ?? null }, { headers: { 'Cache-Control': 'private, no-store' } })
  if (viewer.newCookie) response.cookies.set({ ...viewer.newCookie, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 31536000, secure: request.nextUrl.protocol === 'https:' })
  return response
}

export async function POST(request: NextRequest, context: Context) {
  const { id } = await context.params
  const viewer = await access(request, id)
  if (!viewer) return fail('denied', 403)
  if (viewer.newCookie) return fail('cookie', 409)
  const parsed = action.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('invalid', 400)
  const cmd = parsed.data
  try {
    return await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${id} FOR UPDATE`
      if (cmd.action === 'settings' || cmd.action === 'reopen' || cmd.action === 'resolve') {
        if (!viewer.editor) return fail('denied', 403)
        if (cmd.action === 'settings') await tx.project.update({ where: { id }, data: { selectionTarget: cmd.target, selectionDue: cmd.due ? new Date(cmd.due) : null } })
        if (cmd.action === 'reopen' && !(await tx.proofList.updateMany({ where: { projectId: id, id: cmd.listId }, data: { submittedAt: null } })).count) return fail('missing', 404)
        if (cmd.action === 'resolve' && !(await tx.proofNote.updateMany({ where: { list: { projectId: id }, id: cmd.noteId }, data: { done: cmd.done } })).count) return fail('missing', 404)
      } else {
        const project = await tx.project.findUniqueOrThrow({ where: { id }, select: { selectionTarget: true, isPublic: true, showSelectionPublicly: true, allowGuestSelection: true } })
        if (viewer.actor.startsWith('guest:') && !(project.isPublic && project.showSelectionPublicly && project.allowGuestSelection)) return fail('denied', 403)
        if ('imageId' in cmd && !await tx.selectionImage.count({ where: { projectId: id, id: cmd.imageId } })) return fail('missing', 404)
        const list = await tx.proofList.upsert({ where: { projectId_actor: { projectId: id, actor: viewer.actor } }, update: {}, create: { projectId: id, actor: viewer.actor, name: viewer.name }, select: { id: true, submittedAt: true } })
        if (list.submittedAt) return fail('locked', 409)
        const listId = list.id
        if (cmd.action === 'pick') {
          const pick = { listId, imageId: cmd.imageId }
          if (cmd.value) await tx.proofPick.upsert({ where: { listId_imageId: pick }, create: pick, update: {} })
          else await tx.proofPick.deleteMany({ where: pick })
        } else if (cmd.action === 'note') {
          await tx.proofNote.create({ data: { listId, imageId: cmd.imageId, text: cmd.text } })
        } else {
          const count = await tx.proofPick.count({ where: { listId } })
          if (!count || (project.selectionTarget !== null && count !== project.selectionTarget)) return fail('count', 409)
          if (!viewer.name && !cmd.name) return fail('nameRequired', 400)
          await tx.proofList.update({ where: { id: listId }, data: { submittedAt: new Date(), name: viewer.name || cmd.name } })
          // Invalidate any older serializable folder-deletion snapshot waiting for our project lock.
          await tx.project.update({ where: { id }, data: { updatedAt: new Date() } })
        }
      }
      return NextResponse.json({ ok: true })
    })
  } catch (error) {
    console.error('Selection update failed', error)
    return fail('failed', 500)
  }
}
