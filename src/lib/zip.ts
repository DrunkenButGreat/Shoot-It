import archiver from 'archiver'
import { Readable } from 'stream'
import fs from 'fs'

export interface ArchiveFile {
  fullPath: string // absolute path on disk
  name: string // path inside the zip (incl. subfolders)
}

/**
 * Streams the given files as a ZIP response.
 *
 * Uses `store` (no compression) because the files are already-compressed images
 * and videos — level-9 compression burns huge CPU for ~0% size gain. The archive
 * is exposed through `Readable.toWeb`, which respects backpressure, so memory stays
 * bounded even for very large downloads.
 */
export function archiveResponse(files: ArchiveFile[], filename: string): Response {
  const archive = archiver('zip', { store: true })

  // Surface archiver errors onto the web stream so the client connection fails
  // instead of the process crashing.
  archive.on('error', (err) => {
    archive.destroy(err)
  })

  for (const f of files) {
    if (fs.existsSync(f.fullPath)) {
      archive.file(f.fullPath, { name: f.name })
    }
  }

  // Do not await — finalize triggers streaming; consumption drives the flow.
  archive.finalize()

  return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
