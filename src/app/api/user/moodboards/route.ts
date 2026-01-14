import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { moodboardGroupSchema } from '@/lib/validations'
import { z } from 'zod'

// GET /api/user/moodboards - Get user's private moodboard collection
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const includeArchived = searchParams.get('includeArchived') === 'true'

    const groups = await prisma.moodboardGroup.findMany({
      where: {
        ownerId: session.user.id,
        isLibrary: true,
        isArchived: includeArchived ? undefined : false,
        name: {
          contains: search,
          mode: 'insensitive',
        },
      },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: { projectLinks: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(groups)
  } catch (error) {
    console.error('Error fetching user moodboards:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/user/moodboards - Create a new moodboard in private collection
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = moodboardGroupSchema.parse(body)

    const group = await prisma.moodboardGroup.create({
      data: {
        ...validatedData,
        ownerId: session.user.id,
        isLibrary: true,
      },
      include: {
        images: true,
      },
    })

    return NextResponse.json(group, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input data', details: error.errors }, { status: 400 })
    }
    console.error('Error creating user moodboard:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
