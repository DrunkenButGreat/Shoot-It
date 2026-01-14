import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { moodboardGroupSchema } from '@/lib/validations'
import { canAccessProject } from '@/lib/permissions'

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

    // 2. Check if we need to update the MoodboardGroup itself (name, description)
    if (body.name !== undefined || body.description !== undefined) {
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

import { unlink, rm } from 'fs/promises'
import path from 'path'

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

    // Fetch the group to see if it's a library group
    const group = await prisma.moodboardGroup.findUnique({
      where: { id: groupId },
      select: { isLibrary: true, ownerId: true }
    })

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 })
    }

    // If it's NOT a library group, delete the group entirely
    if (!group.isLibrary) {
      // Only the owner of the group (or project owner) should be able to delete it?
      // For now, let's just delete it since it's project-specific
      await prisma.moodboardGroup.delete({
        where: { id: groupId }
      })
    } else {
      // If it's a library group, ONLY delete the link
      await prisma.projectMoodboardLink.delete({
        where: {
          projectId_groupId: {
            projectId: id,
            groupId: groupId,
          },
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unlinking moodboard group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
