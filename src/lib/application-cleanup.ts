import prisma from '@/lib/prisma'
import { queueFileCleanup } from '@/lib/file-cleanup'

export async function cleanupExpiredApplications() {
  const now = new Date()
  const expired = await prisma.projectApplication.findMany({
    where: { status: 'REJECTED', deletedAt: { lt: now } },
    select: { id: true, projectId: true },
    take: 100,
  })
  for (const application of expired) {
    await prisma.$transaction(async tx => {
      const deleted = await tx.projectApplication.deleteMany({
        where: { id: application.id, status: 'REJECTED', deletedAt: { lt: now } },
      })
      if (deleted.count) await queueFileCleanup(tx, [`applications/${application.projectId}/${application.id}`])
    })
  }
}
