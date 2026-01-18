import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canEditProject } from '@/lib/permissions'

import { rm } from 'fs/promises'
import path from 'path'

// Helper function to get all subfolder IDs recursively
async function getAllSubfolderIds(folderId: string): Promise<string[]> {
  const children = await prisma.resultFolder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  })

  let ids = children.map((c) => c.id)
  for (const id of ids) {
    const subIds = await getAllSubfolderIds(id)
    ids = [...ids, ...subIds]
  }
  return ids
}

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

    // Get all subfolder IDs to delete their directories too
    const subfolderIds = await getAllSubfolderIds(folderId)
    const allFolderIds = [folderId, ...subfolderIds]

    // Delete folder directories from filesystem
    for (const fid of allFolderIds) {
      const folderDir = path.join(process.cwd(), 'uploads', 'results', id, fid)
      try {
        await rm(folderDir, { recursive: true, force: true })
      } catch (err) {
        console.error(`Error deleting folder directory ${fid}:`, err)
      }
    }

    await prisma.resultFolder.delete({
      where: {
        id: folderId,
        projectId: id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting folder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
