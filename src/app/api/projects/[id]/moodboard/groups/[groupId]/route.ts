import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessProject } from '@/lib/permissions'
import { queueFileCleanup } from '@/lib/file-cleanup'

// PUT /api/projects/[id]/moodboard/groups/[groupId] - Update a group
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, groupId } = await params

    // Check if user has access to the project
    const hasAccess = await canAccessProject(session.user.id, id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!await prisma.projectMoodboardLink.findUnique({
      where: { projectId_groupId: { projectId: id, groupId } }, select: { id: true }
    })) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    const body = await request.json()

    // 1. Check if we need to update the ProjectMoodboardLink (status, order)
    if (body.status !== undefined || body.order !== undefined) {
      await prisma.projectMoodboardLink.update({
        where: {
          projectId_groupId: {
            projectId: id,
            groupId: groupId
          }
        },
        data: {
          ...(body.status !== undefined && { status: body.status }),
          ...(body.order !== undefined && { order: body.order }),
        }
      })
    }

    // 2. Check if we need to update the MoodboardGroup itself (name, description, favorite)
    if (body.name !== undefined || body.description !== undefined || body.isFavorite !== undefined) {
      // Check if user is the owner of the group
      const existingGroup = await prisma.moodboardGroup.findUnique({
        where: { id: groupId },
        select: { ownerId: true }
      })

      if (!existingGroup || existingGroup.ownerId !== session.user.id) {
        // If not the owner, we ignore these changes or return 403 
        // if they ONLY tried to update these.
        if (body.status === undefined && body.order === undefined) {
          return NextResponse.json({ error: 'Forbidden: Only owner can edit group details' }, { status: 403 })
        }
      } else {
        await prisma.moodboardGroup.update({
          where: { id: groupId },
          data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.isFavorite !== undefined && { isFavorite: body.isFavorite }),
          }
        })
      }
    }

    // Fetch the updated group (via the link context if possible, but the route is group-based)
    const group = await prisma.moodboardGroup.findUnique({
      where: { id: groupId },
      include: {
        images: true,
        projectLinks: {
          where: { projectId: id },
          include: {
            comments: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, image: true }
                }
              }
            }
          }
        }
      }
    })

    return NextResponse.json(group)
  } catch (error) {
    console.error('Error updating moodboard group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


// DELETE /api/projects/[id]/moodboard/groups/[groupId] - Delete a group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, groupId } = await params

    // Check if user has access to the project
    const hasAccess = await canAccessProject(session.user.id, id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!await prisma.projectMoodboardLink.findUnique({
      where: { projectId_groupId: { projectId: id, groupId } }, select: { id: true }
    })) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // Fetch the group to see if it's a library group
    const group = await prisma.moodboardGroup.findUnique({
      where: { id: groupId },
      select: { isLibrary: true, ownerId: true }
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    await prisma.$transaction(async tx => {
      await tx.projectMoodboardLink.delete({
        where: { projectId_groupId: { projectId: id, groupId } },
      })
      // A project-created group may also be linked elsewhere; preserve those shares.
      if (!group.isLibrary) {
        const images = await tx.moodboardImage.findMany({ where: { groupId }, select: { path: true, thumbnail: true } })
        const deleted = await tx.moodboardGroup.deleteMany({
          where: { id: groupId, projectLinks: { none: {} } },
        })
        if (deleted.count) await queueFileCleanup(tx, images.flatMap(image => [image.path, image.thumbnail]).filter(url => url?.startsWith('/api/uploads/')), 'moodboard')
      }
    }, { isolationLevel: 'Serializable' })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unlinking moodboard group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
