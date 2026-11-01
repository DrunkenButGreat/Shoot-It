import { readdir, stat } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')
const cache = new Map<string, { expires: number; value: Awaited<ReturnType<typeof calculateStorage>> }>()

async function getDirectorySize(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const sizes = await Promise.all(entries.map(async entry => {
      const entryPath = path.join(dir, entry.name)
      if (entry.isDirectory()) return getDirectorySize(entryPath)
      if (entry.isFile()) return (await stat(entryPath).catch(() => ({ size: 0 }))).size
      return 0
    }))
    return sizes.reduce((total, size) => total + size, 0)
  } catch {
    return 0
  }
}

async function calculateStorage(projectIds: string[]) {
  const links = await prisma.projectMoodboardLink.findMany({
    where: { projectId: { in: projectIds } },
    select: { projectId: true, group: { select: { images: { select: { path: true, thumbnail: true } } } } },
  })
  const fileSizes = new Map<string, Promise<number>>()
  const moodboardSize = (url: string | null) => {
    if (!url?.startsWith('/api/uploads/moodboard/')) return Promise.resolve(0)
    const file = path.resolve(UPLOADS_DIR, url.slice('/api/uploads/'.length))
    if (!file.startsWith(path.join(UPLOADS_DIR, 'moodboard') + path.sep)) return Promise.resolve(0)
    if (!fileSizes.has(file)) fileSizes.set(file, stat(file).then(s => s.size).catch(() => 0))
    return fileSizes.get(file)!
  }
  const projects = await Promise.all(projectIds.map(async projectId => {
    const urls = new Set(links.filter(link => link.projectId === projectId).flatMap(link => link.group.images.flatMap(image => [image.path, image.thumbnail])))
    const sizes = await Promise.all([
      ...['selection', 'results', 'applications', 'projects'].map(category => getDirectorySize(path.join(UPLOADS_DIR, category, projectId))),
      ...[...urls].map(moodboardSize),
    ])
    return { projectId, bytes: sizes.reduce((sum, size) => sum + size, 0), moodboardBytes: (await Promise.all([...urls].map(moodboardSize))).reduce((a, b) => a + b, 0) }
  }))
  const totalBytes = projects.reduce((sum, project) => sum + project.bytes - project.moodboardBytes, 0) + (await Promise.all(fileSizes.values())).reduce((a, b) => a + b, 0)
  return { totalBytes, projects: projects.map(({ projectId, bytes }) => ({ projectId, bytes })) }
}

export async function getStorageOverview(projectIds: string[]) {
  const ids = [...new Set(projectIds)].sort()
  const key = JSON.stringify(ids)
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value
  const value = await calculateStorage(ids)
  // shortcut: storage figures may lag by 30 seconds, replace with tracked byte counters if scans become expensive.
  if (cache.size >= 100) cache.clear()
  cache.set(key, { expires: Date.now() + 30_000, value })
  return value
}
