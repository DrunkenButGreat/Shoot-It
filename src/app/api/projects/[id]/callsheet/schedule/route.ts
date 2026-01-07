import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { scheduleItemSchema } from '@/lib/validations'
import { canEditProject } from '@/lib/permissions'

// POST /api/projects/[id]/callsheet/schedule - Add schedule item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if user can edit this project
    const canEdit = await canEditProject(session.user.id, id)
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = scheduleItemSchema.parse(body)

    // Get or create callsheet
    let callsheet = await prisma.callsheet.findUnique({
      where: { projectId: id },
    })

    if (!callsheet) {
      callsheet = await prisma.callsheet.create({
        data: { projectId: id },
      })
    }

    const scheduleItem = await prisma.callsheetScheduleItem.create({
      data: {
        ...validatedData,
        callsheetId: callsheet.id,
      },
    })

    return NextResponse.json(scheduleItem, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    console.error('Error adding schedule item:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
