import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessProject } from '@/lib/permissions'

// GET /api/projects/[id]/selection - Get all selection images with ratings
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
    const { searchParams } = new URL(request.url)
    const filterStars = searchParams.get('stars')
    const filterColor = searchParams.get('color')

    // Check if user has access to this project
    const hasAccess = await canAccessProject(session.user.id, id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Build filter conditions
    const ratingFilter: any = {}
    if (filterStars) {
      ratingFilter.stars = parseInt(filterStars)
    }
    if (filterColor) {
      ratingFilter.color = filterColor
    }

    const images = await prisma.selectionImage.findMany({
      where: {
        projectId: id,
        ...(Object.keys(ratingFilter).length > 0 && {
          ratings: {
            some: {
              userId: session.user.id,
              ...ratingFilter,
            },
          },
        }),
      },
      include: {
        ratings: {
          where: {
            userId: session.user.id,
          },
        },
      },
      orderBy: { importedAt: 'desc' },
    })

    return NextResponse.json({ images })
  } catch (error) {
    console.error('Error fetching selection images:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
