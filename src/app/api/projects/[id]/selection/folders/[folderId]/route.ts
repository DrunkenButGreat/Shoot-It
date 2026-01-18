import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canEditProject } from '@/lib/permissions'
import { selectionFolderSchema } from '@/lib/validations'
import { rm, unlink } from 'fs/promises'
import path from 'path'

// Helper function to get all subfolder IDs recursively
async function getAllSubfolderIds(folderId: string): Promise<string[]> {
  const children = await prisma.selectionFolder.findMany({
    where: { parentId: folderId } as any,
    select: { id: true },
  })

  let ids = children.map((c) => c.id)
  for (const id of ids) {
    const subIds = await getAllSubfolderIds(id)
    ids = [...ids, ...subIds]
  }
  return ids
}

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

    // Get all subfolder IDs
    const subfolderIds = await getAllSubfolderIds(folderId)
    const allFolderIds = [folderId, ...subfolderIds]

    // Find all images in these folders to delete files
    const images = await prisma.selectionImage.findMany({
      where: {
        folderId: { in: allFolderIds }
      }
    })

    // Delete files from filesystem
    for (const img of images) {
      // img.path is /api/uploads/selection/[projectId]/[filename]
      // We need to convert it to a relative path from the 'uploads' directory
      const relativePath = img.path.replace('/api/uploads/', '')
      const fullPath = path.join(process.cwd(), 'uploads', relativePath)
      
      try {
        await unlink(fullPath)
        if (img.thumbnail) {
          const thumbRelativePath = img.thumbnail.replace('/api/uploads/', '')
          const thumbFullPath = path.join(process.cwd(), 'uploads', thumbRelativePath)
          await unlink(thumbFullPath)
        }
      } catch (err) {
        console.error(`Error deleting file ${fullPath}:`, err)
      }
    }

    await prisma.selectionFolder.delete({
      where: {
        id: folderId,
        projectId: id,
      },
    })

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

    const existing = await prisma.selectionFolder.findUnique({
      where: { id: folderId }
    }) as any

    if (!existing) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Update path if name changes or parent changes
    let newPath = existing.path
    if (validatedData.name !== existing.name || validatedData.parentId !== existing.parentId) {
      if (validatedData.parentId) {
        const parent = await prisma.selectionFolder.findUnique({
          where: { id: validatedData.parentId }
        }) as any
        if (parent) {
          newPath = `${parent.path}/${validatedData.name}`
        }
      } else {
        newPath = `/${validatedData.name}`
      }
    }

    const folder = await prisma.selectionFolder.update({
      where: { id: folderId },
      data: {
        ...validatedData,
        path: newPath
      } as any
    })

    return NextResponse.json(folder)
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    console.error('Error updating selection folder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
