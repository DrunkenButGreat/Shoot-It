import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'

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
      await tx.resultFile.deleteMany({ where: { id: { in: ids }, projectId } })
      return found
    })
    if (!images) return NextResponse.json({ error: 'Images not found in project' }, { status: 404 })
    const root = path.resolve(process.cwd(), 'uploads')
    for (const image of images) {
      for (const url of new Set([image.path, image.thumbnail].filter((v): v is string => !!v))) {
        // Local-media sources are external references: never delete their originals.
        if (!url.startsWith('/api/uploads/')) continue
        const file = path.resolve(root, url.slice('/api/uploads/'.length))
        if (!file.startsWith(root + path.sep)) continue
        await unlink(file).catch(error => {
          if (error.code !== 'ENOENT') console.error('Result file cleanup failed', error)
        })
      }
    }
    return NextResponse.json({ success: true, count: images.length })
  } catch (error) {
    console.error('Bulk result deletion failed', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
