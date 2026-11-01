import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { queueFileCleanup } from '@/lib/file-cleanup'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: projectId } = await params
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: session.user.id }, select: { id: true } })
  if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const input = z.object({ imageIds: z.array(z.string().min(1).max(200)).min(1).max(10000) }).safeParse(await request.json().catch(() => null))
  if (!input.success) return NextResponse.json({ error: 'Invalid image IDs' }, { status: 400 })
  const ids = [...new Set(input.data.imageIds)]
  try {
    const images = await prisma.$transaction(async tx => {
      const found = await tx.resultFile.findMany({ where: { id: { in: ids }, projectId } })
      if (found.length !== ids.length) return null
      await queueFileCleanup(tx, found.flatMap(image => [image.path, image.thumbnail]).filter(url => url?.startsWith('/api/uploads/')), `results/${projectId}`)
      await tx.resultFile.deleteMany({ where: { id: { in: ids }, projectId } })
      return found
    })
    if (!images) return NextResponse.json({ error: 'Images not found in project' }, { status: 404 })
    return NextResponse.json({ success: true, count: images.length })
  } catch (error) {
    console.error('Bulk result deletion failed', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
