import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { resultFolderSchema } from '@/lib/validations'
import { canEditProject } from '@/lib/permissions'

// POST /api/projects/[id]/results/folders - Create a folder
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
    const validatedData = resultFolderSchema.parse(body)

    let path = `/${validatedData.name}`
    if (validatedData.parentId) {
      const parent = await prisma.resultFolder.findUnique({
        where: { id: validatedData.parentId },
      })
      if (parent) {
        path = `${parent.path}/${validatedData.name}`
      }
    }

    const folder = await prisma.resultFolder.create({
      data: {
        ...validatedData,
        path,
        projectId: id,
      },
      include: {
        images: true,
      },
    })

    return NextResponse.json(folder, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    console.error('Error creating folder:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
