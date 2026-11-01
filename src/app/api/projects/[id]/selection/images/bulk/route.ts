import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canEditProject } from '@/lib/permissions'
import { queueFileCleanup } from '@/lib/file-cleanup'

// PATCH /api/projects/[id]/selection/images/bulk - Bulk update images (e.g. move to folder)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    const canEdit = await canEditProject(session.user.id, projectId)
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const ids = body.ids ?? body.imageIds
    const { folderId } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    // Verify folder belongs to project if provided
    if (folderId && folderId !== 'root') {
      const folder = await prisma.selectionFolder.findUnique({
        where: { id: folderId, projectId }
      })
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
      }
    }

    const updated = await prisma.selectionImage.updateMany({
      where: {
        id: { in: ids },
        projectId
      },
      data: {
        folderId: folderId === 'root' ? null : folderId
      }
    })

    return NextResponse.json({ success: true, count: updated.count })
  } catch (error) {
    console.error('Error bulk updating selection images:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/selection/images/bulk - Bulk delete images
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params

    const canEdit = await canEditProject(session.user.id, projectId)
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const ids = body.ids ?? body.imageIds

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    const deleted = await prisma.$transaction(async tx => {
      const images = await tx.selectionImage.findMany({ where: { id: { in: ids }, projectId } })
      await queueFileCleanup(tx, images.flatMap(image => [image.path, image.thumbnail]).filter(url => url?.startsWith('/api/uploads/')), `selection/${projectId}`)
      return tx.selectionImage.deleteMany({ where: { id: { in: ids }, projectId } })
    }, { isolationLevel: 'Serializable' })

    return NextResponse.json({ success: true, count: deleted.count })
  } catch (error) {
    console.error('Error bulk deleting selection images:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
