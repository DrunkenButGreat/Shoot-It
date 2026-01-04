import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { moodboardGroupSchema } from '@/lib/validations'
import { canEditProject } from '@/lib/permissions'

// POST /api/projects/[id]/moodboard/groups - Create a new group
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Check if user can edit this project
    const canEdit = await canEditProject(session.user.id, id)
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = moodboardGroupSchema.parse(body)

    // Get the current max order
    const maxOrder = await prisma.moodboardGroup.findFirst({
      where: { projectId: id },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const group = await prisma.moodboardGroup.create({
      data: {
        ...validatedData,
        projectId: id,
        order: (maxOrder?.order ?? -1) + 1,
      },
      include: {
        images: true,
        comments: true,
      },
    })

    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    console.error('Error creating moodboard group:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
