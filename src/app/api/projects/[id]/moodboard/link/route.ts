import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canEditProject } from '@/lib/permissions'
import { z } from 'zod'

const linkSchema = z.object({
  groupId: z.string().cuid(),
})

// POST /api/projects/[id]/moodboard/link - Link an existing group to project
export async function POST(
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
    const { groupId } = linkSchema.parse(body)

    // Check if group exists and user owns it (or has access?)
    // For now, only owner can link their own groups
    const group = await prisma.moodboardGroup.findUnique({
      where: { id: groupId }
    })

    if (!group || group.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Group not found or access denied' }, { status: 404 })
    }

    // Get max order
    const maxOrder = await prisma.projectMoodboardLink.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const link = await prisma.projectMoodboardLink.create({
      data: {
        projectId,
        groupId,
        order: (maxOrder?.order ?? -1) + 1,
      },
      include: {
        group: {
          include: { images: true }
        }
      }
    })

    return NextResponse.json(link, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    console.error('Error linking moodboard group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
