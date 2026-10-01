import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse(null, { status: 401 })
  const userId = session.user.id
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user) return new NextResponse(null, { status: 401 })
  const visits = await prisma.projectVisit.findMany({
    where: { userId, project: { OR: [
      { ownerId: userId }, { access: { some: { userId } } },
      { participants: { some: { email: user.email } } },
    ] } },
    orderBy: [{ openedAt: 'desc' }, { projectId: 'asc' }], take: 3,
    select: { project: { select: { id: true, name: true } } },
  })
  return NextResponse.json(visits.map(visit => visit.project), { headers: { 'Cache-Control': 'no-store' } })
}
