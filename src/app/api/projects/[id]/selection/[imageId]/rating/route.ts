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
    const { id, imageId } = await params
    const body = await request.json()
    const validatedData = ratingSchema.parse(body)
    const { guestId, ...ratingData } = validatedData

    const userId = session?.user?.id
    // The path is decided by authorization (project access), not merely by
    // whether someone is logged in. Anyone without access is treated as a guest
    // when the project allows guest selection.
    const hasAccess = userId ? await canAccessProject(userId, id) : false

    if (!hasAccess) {
      // Guest access check
      const project = await prisma.project.findUnique({
        where: { id },
        select: { allowGuestSelection: true }
      })

      if (!project?.allowGuestSelection) {
        // Logged-in users without access get 403, true guests get 401.
        return NextResponse.json(
          { error: userId ? 'Forbidden' : 'Unauthorized' },
          { status: userId ? 403 : 401 }
        )
      }

      if (!guestId) {
        return NextResponse.json({ error: 'Guest ID required' }, { status: 400 })
      }

      // Verify the image belongs to the project
      const image = await prisma.selectionImage.findUnique({
        where: { id: imageId },
        select: { projectId: true }
      })

      if (!image || image.projectId !== id) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 })
      }

      // Upsert shared rating (identified only by imageId)
      const rating = await prisma.imageRating.upsert({
        where: { imageId },
        update: {
          stars: ratingData.stars,
          color: ratingData.color as any,
          guestId,
          userId: null,
        },
        create: {
          imageId,
          stars: ratingData.stars,
          color: ratingData.color as any,
          guestId,
        },
      })

      return NextResponse.json(rating)
    }

    // Verify the image belongs to the project
    const image = await prisma.selectionImage.findUnique({
      where: { id: imageId },
      select: { projectId: true }
    })

    if (!image || image.projectId !== id) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Upsert shared rating (identified only by imageId)
    const rating = await prisma.imageRating.upsert({
      where: { imageId },
      update: {
        stars: ratingData.stars,
        color: ratingData.color as any,
        userId,
        guestId: null,
      },
      create: {
        imageId,
        stars: ratingData.stars,
        color: ratingData.color as any,
        userId,
      },
    })

    return NextResponse.json(rating)
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid input data', details: error.message }, { status: 400 })
    }
    console.error('Error updating rating:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}
