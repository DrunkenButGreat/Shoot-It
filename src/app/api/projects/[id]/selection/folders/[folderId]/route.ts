import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canEditProject } from '@/lib/permissions'
import { selectionFolderSchema } from '@/lib/validations'
import { queueFileCleanup } from '@/lib/file-cleanup'

// DELETE /api/projects/[id]/selection/folders/[folderId] - Delete a folder
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, folderId } = await params

    const canEdit = await canEditProject(session.user.id, id)
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const deleted = await prisma.$transaction(async tx => {
      const folder = await tx.selectionFolder.findFirst({ where: { id: folderId, projectId: id } })
      if (!folder) return false
      const folders = await tx.selectionFolder.findMany({ where: { projectId: id }, select: { id: true, parentId: true } })
      const ids = [folderId]
      for (let i = 0; i < ids.length; i++) {
        for (const child of folders) if (child.parentId === ids[i] && !ids.includes(child.id)) ids.push(child.id)
      }
      const images = await tx.selectionImage.findMany({ where: { projectId: id, folderId: { in: ids } } })
      await queueFileCleanup(tx, images.flatMap(image => [image.path, image.thumbnail]), `selection/${id}`)
      await tx.selectionImage.deleteMany({ where: { projectId: id, folderId: { in: ids } } })
      await tx.selectionFolder.delete({ where: { id: folderId, projectId: id } })
      return true
    }, { isolationLevel: 'Serializable' })
    if (!deleted) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting selection folder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/projects/[id]/selection/folders/[folderId] - Update folder
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; folderId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, folderId } = await params

    const canEdit = await canEditProject(session.user.id, id)
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = selectionFolderSchema.parse(body)

    const result = await prisma.$transaction(async tx => {
      const existing = await tx.selectionFolder.findFirst({ where: { id: folderId, projectId: id } })
      if (!existing) return { error: 'Folder not found', status: 404 } as const
      const folders = await tx.selectionFolder.findMany({ where: { projectId: id } })
      const descendants = [existing]
      for (let i = 0; i < descendants.length; i++) {
        for (const child of folders) if (child.parentId === descendants[i].id && !descendants.some(f => f.id === child.id)) descendants.push(child)
      }
      const parentId = validatedData.parentId ?? null
      if (parentId && descendants.some(f => f.id === parentId)) return { error: 'Invalid parent folder', status: 400 } as const
      const parent = parentId ? folders.find(f => f.id === parentId) : null
      if (parentId && !parent) return { error: 'Parent folder not found', status: 404 } as const
      const newPath = `${parent?.path ?? ''}/${validatedData.name}`
      const paths = new Map([[folderId, newPath]])
      for (const child of descendants.slice(1)) paths.set(child.id, `${paths.get(child.parentId!)}/${child.name}`)
      const folder = await tx.selectionFolder.update({ where: { id: folderId, projectId: id }, data: { name: validatedData.name, parentId, path: newPath } })
      for (const child of descendants.slice(1)) await tx.selectionFolder.update({ where: { id: child.id }, data: { path: paths.get(child.id)! } })
      return { folder } as const
    }, { isolationLevel: 'Serializable' })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
    const { folder } = result

    return NextResponse.json(folder)
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    if ((error as { code?: string }).code === 'P2034') return NextResponse.json({ error: 'Folder changed concurrently; please retry' }, { status: 409 })
    if ((error as { code?: string }).code === 'P2002') return NextResponse.json({ error: 'Folder already exists' }, { status: 409 })
    console.error('Error updating selection folder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
