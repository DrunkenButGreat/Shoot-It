import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { queueFileCleanup } from '@/lib/file-cleanup'

// PUT /api/user/moodboards/[id] - Update private group (name, archived)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: groupId } = await params
    const body = await request.json()

    const group = await prisma.moodboardGroup.findUnique({
      where: { id: groupId },
      select: { ownerId: true }
    })

    if (!group || group.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updated = await prisma.moodboardGroup.update({
      where: { id: groupId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.isArchived !== undefined && { isArchived: body.isArchived }),
        ...(body.isFavorite !== undefined && { isFavorite: body.isFavorite }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating private moodboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/user/moodboards/[id] - PERMANENTLY delete group and all its images
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: groupId } = await params

    const group = await prisma.moodboardGroup.findUnique({
      where: { id: groupId },
      include: { images: true }
    })

    if (!group || group.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.$transaction(async tx => {
      await queueFileCleanup(tx, group.images.flatMap(image => [image.path, image.thumbnail]), 'moodboard')
      await tx.moodboardGroup.delete({ where: { id: groupId } })
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Error deleting private moodboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
