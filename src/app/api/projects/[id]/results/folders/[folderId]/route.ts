import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canEditProject } from '@/lib/permissions'

import { queueFileCleanup } from '@/lib/file-cleanup'

// DELETE /api/projects/[id]/results/folders/[folderId] - Delete a folder
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

    // Check if user can edit this project
    const canEdit = await canEditProject(session.user.id, id)
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const deleted = await prisma.$transaction(async tx => {
      const folder = await tx.resultFolder.findFirst({ where: { id: folderId, projectId: id } })
      if (!folder) return false
      const folders = await tx.resultFolder.findMany({ where: { projectId: id }, select: { id: true, parentId: true } })
      const ids = [folderId]
      for (let i = 0; i < ids.length; i++) {
        for (const child of folders) if (child.parentId === ids[i] && !ids.includes(child.id)) ids.push(child.id)
      }
      const images = await tx.resultFile.findMany({ where: { projectId: id, folderId: { in: ids } } })
      await queueFileCleanup(tx, images.flatMap(image => [image.path, image.thumbnail]), `results/${id}`)
      await tx.resultFile.deleteMany({ where: { projectId: id, folderId: { in: ids } } })
      await tx.resultFolder.delete({ where: { id: folderId, projectId: id } })
      return true
    }, { isolationLevel: 'Serializable' })
    if (!deleted) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting folder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
