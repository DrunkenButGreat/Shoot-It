import { readdir, stat } from 'fs/promises'
import path from 'path'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

async function getDirectorySize(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    let total = 0

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        total += await getDirectorySize(entryPath)
      } else if (entry.isFile()) {
        try {
          const fileStat = await stat(entryPath)
          total += fileStat.size
        } catch {
          // Datei wurde möglicherweise während der Berechnung entfernt.
        }
      }
    }

    return total
  } catch {
    // Verzeichnis existiert möglicherweise noch nicht.
    return 0
  }
}

export async function getStorageOverview(projectIds: string[]) {
  const [totalBytes, ...projectSizes] = await Promise.all([
    getDirectorySize(UPLOADS_DIR),
    ...projectIds.map(async (projectId) => {
      const [selection, results, moodboard] = await Promise.all([
        getDirectorySize(path.join(UPLOADS_DIR, 'selection', projectId)),
        getDirectorySize(path.join(UPLOADS_DIR, 'results', projectId)),
        getDirectorySize(path.join(UPLOADS_DIR, 'moodboard', projectId)),
      ])

      return {
        projectId,
        bytes: selection + results + moodboard,
      }
    }),
  ])

  return {
    totalBytes,
    projects: projectSizes,
  }
}
