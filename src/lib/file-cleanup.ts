import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { rm } from 'fs/promises'
import path from 'path'

const uploads = path.resolve(process.cwd(), 'uploads')

function relativeUploadPath(value: string): string {
  const relative = value.startsWith('/api/uploads/') ? value.slice('/api/uploads/'.length) : value
  const parts = relative.split('/')
  if (!['selection', 'results', 'applications', 'projects', 'moodboard'].includes(parts[0]) || parts.length < (parts[0] === 'moodboard' ? 3 : 2) || parts.some(part => !part || part === '.' || part === '..' || part.includes('\\'))) {
    throw new Error('Invalid upload cleanup path')
  }
  return relative
}

export async function queueFileCleanup(tx: Prisma.TransactionClient, paths: (string | null)[], requiredPrefix?: string) {
  const unique = [...new Set(paths.filter((value): value is string => Boolean(value)).map(relativeUploadPath))]
  if (requiredPrefix && unique.some(value => !value.startsWith(requiredPrefix + '/'))) throw new Error('Upload path is outside its project')
  if (unique.length) await tx.fileCleanupJob.createMany({ data: unique.map(path => ({ path })), skipDuplicates: true })
}

export async function cleanupPendingFiles() {
  const jobs = await prisma.fileCleanupJob.findMany({ orderBy: { createdAt: 'asc' }, take: 100 })
  for (const job of jobs) {
    try {
      const relative = relativeUploadPath(job.path)
      const url = `/api/uploads/${relative}`
      const where = { OR: [{ path: url }, { thumbnail: url }] }
      const references = await Promise.all([
        prisma.selectionImage.findFirst({ where, select: { id: true } }),
        prisma.resultFile.findFirst({ where, select: { id: true } }),
        prisma.moodboardImage.findFirst({ where, select: { id: true } }),
        prisma.participantImage.findFirst({ where, select: { id: true } }),
        prisma.applicationImage.findFirst({ where, select: { id: true } }),
      ])
      if (references.some(Boolean)) {
        await prisma.fileCleanupJob.deleteMany({ where: { path: job.path } })
        continue
      }

      await rm(path.join(uploads, relative), { recursive: true, force: true })
      await prisma.fileCleanupJob.deleteMany({ where: { path: job.path } })
    } catch (error) {
      console.error(`File cleanup failed for ${job.path}:`, error)
      try {
        await prisma.fileCleanupJob.updateMany({ where: { path: job.path }, data: { createdAt: new Date() } })
      } catch (updateError) {
        console.error(`Could not reschedule file cleanup for ${job.path}:`, updateError)
      }
    }
  }
}
