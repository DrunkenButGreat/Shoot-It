export interface DownloadFile {
  url: string
  relativePath: string // e.g. "Folder/Sub/image.jpg"
}

export function supportsDirectDownload(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/**
 * Fetches a download manifest from a download endpoint (`mode: 'manifest'`) and
 * writes the files directly to a user-chosen directory, preserving structure.
 * Returns the failure count, or `null` if the user cancelled.
 */
export async function directDownloadViaManifest(
  endpoint: string,
  body: Record<string, unknown>,
  onProgress?: (done: number, total: number) => void
): Promise<{ failed: number } | null> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, mode: 'manifest' }),
  })
  if (!res.ok) throw new Error('Failed to load download manifest')
  const { files } = (await res.json()) as { files: DownloadFile[] }
  return downloadToDirectory(files, onProgress)
}

/**
 * Downloads files directly to a user-chosen directory, recreating the folder
 * structure from each file's `relativePath`. Uses the File System Access API
 * (Chromium only — callers should gate on `supportsDirectDownload()`).
 *
 * Returns the number of failed files, or `null` if the user cancelled the picker.
 */
export async function downloadToDirectory(
  files: DownloadFile[],
  onProgress?: (done: number, total: number) => void
): Promise<{ failed: number } | null> {
  let root: any
  try {
    root = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
  } catch (e: any) {
    // User dismissed the picker.
    if (e?.name === 'AbortError') return null
    throw e
  }

  // Cache directory handles so parallel writes don't race on creating folders.
  const dirCache = new Map<string, any>()
  dirCache.set('', root)

  const getDir = async (segments: string[]): Promise<any> => {
    const key = segments.join('/')
    const cached = dirCache.get(key)
    if (cached) return cached

    const parent = await getDir(segments.slice(0, -1))
    const handle = await parent.getDirectoryHandle(segments[segments.length - 1], { create: true })
    dirCache.set(key, handle)
    return handle
  }

  const CONCURRENCY = 4
  let done = 0
  let failed = 0

  const writeOne = async (file: DownloadFile) => {
    try {
      const parts = file.relativePath.split('/').filter(Boolean)
      const fileName = parts.pop() as string
      const dir = await getDir(parts)

      const res = await fetch(file.url)
      if (!res.ok || !res.body) throw new Error(`Fetch failed: ${res.status}`)

      const fileHandle = await dir.getFileHandle(fileName, { create: true })
      const writable = await fileHandle.createWritable()
      await res.body.pipeTo(writable)
    } catch (e) {
      console.error(`Direct download failed for ${file.relativePath}:`, e)
      failed++
    } finally {
      done++
      onProgress?.(done, files.length)
    }
  }

  let cursor = 0
  const worker = async () => {
    while (cursor < files.length) {
      await writeOne(files[cursor++])
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker())
  )

  return { failed }
}
