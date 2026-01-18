import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canEditProject } from '@/lib/permissions'
import { unlink } from 'fs/promises'
import path from 'path'

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
    const { ids, folderId } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    // Verify folder belongs to project if provided
    if (folderId) {
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
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    // Get images to delete from disk
    const images = await prisma.selectionImage.findMany({
      where: {
        id: { in: ids },
        projectId
      }
    })

    // Delete files
    for (const img of images) {
      const relativePath = img.path.replace('/api/uploads/', '')
      const fullPath = path.join(process.cwd(), 'uploads', relativePath)
      
      try {
        await unlink(fullPath).catch(() => {})
        if (img.thumbnail) {
          const thumbRelativePath = img.thumbnail.replace('/api/uploads/', '')
          const thumbFullPath = path.join(process.cwd(), 'uploads', thumbRelativePath)
          await unlink(thumbFullPath).catch(() => {})
        }
      } catch (err) {
        console.error(`Error deleting file ${fullPath}:`, err)
      }
    }

    // Delete from DB
    const deleted = await prisma.selectionImage.deleteMany({
      where: {
        id: { in: ids },
        projectId
      }
    })

    return NextResponse.json({ success: true, count: deleted.count })
  } catch (error) {
    console.error('Error bulk deleting selection images:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
