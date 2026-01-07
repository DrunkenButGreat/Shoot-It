import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { ratingSchema } from '@/lib/validations'
import { canAccessProject } from '@/lib/permissions'

// PUT /api/projects/[id]/selection/[imageId]/rating - Update rating for an image
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, imageId } = await params

    // Check if user has access to this project
    const hasAccess = await canAccessProject(session.user.id, id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = ratingSchema.parse(body)

    // Upsert rating (create or update)
    const rating = await prisma.imageRating.upsert({
      where: {
        imageId_userId: {
          imageId,
          userId: session.user.id,
        },
      },
      update: validatedData,
      create: {
        ...validatedData,
        imageId,
        userId: session.user.id,
      },
    })

    return NextResponse.json(rating)
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data' }, { status: 400 })
    }
    console.error('Error updating rating:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
