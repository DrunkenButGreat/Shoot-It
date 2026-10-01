import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canAccessProject } from '@/lib/permissions'
import { NextResponse } from 'next/server'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse(null, { status: 401 })
  const { id: projectId } = await params
  const userId = session.user.id
  if (!await canAccessProject(userId, projectId)) return new NextResponse(null, { status: 403 })
  await prisma.projectVisit.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId },
    update: { openedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
