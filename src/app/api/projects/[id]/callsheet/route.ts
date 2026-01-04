import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { callsheetSchema } from '@/lib/validations'
import { canAccessProject, canEditProject } from '@/lib/permissions'

// GET /api/projects/[id]/callsheet - Get callsheet
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Check if user has access to this project
    const hasAccess = await canAccessProject(session.user.id, id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const callsheet = await prisma.callsheet.findUnique({
      where: { projectId: id },
      include: {
        schedule: {
          orderBy: { time: 'asc' },
        },
      },
    })

    return NextResponse.json({ callsheet })
  } catch (error) {
    console.error('Error fetching callsheet:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/callsheet - Create or update callsheet
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
    const validatedData = callsheetSchema.parse(body)

    // Upsert callsheet
    const callsheet = await prisma.callsheet.upsert({
      where: { projectId: id },
      update: validatedData,
      create: {
        ...validatedData,
        projectId: id,
      },
      include: {
        schedule: true,
      },
    })

    return NextResponse.json(callsheet)
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    console.error('Error creating/updating callsheet:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
