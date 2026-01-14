import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessProject } from '@/lib/permissions'

// GET /api/projects/[id]/results - Get folder structure
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    const project = await prisma.project.findUnique({
      where: { id },
      select: { isPublic: true, showResultsPublicly: true }
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const isPublicAccess = project.isPublic && project.showResultsPublicly

    if (!session?.user?.id && !isPublicAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has access to this project (if not public)
    if (session?.user?.id) {
      const hasAccess = await canAccessProject(session.user.id, id)
      if (!hasAccess && !isPublicAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (!isPublicAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all folders with their images
    const folders = await prisma.resultFolder.findMany({
      where: { projectId: id },
      include: {
        images: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { images: true }
        }
      },
      orderBy: { createdAt: 'asc' },
    })

    const rootImages = await prisma.resultFile.findMany({
      where: { 
        projectId: id,
        folderId: null
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({ folders, rootImages })
  } catch (error) {
    console.error('Error fetching results:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
