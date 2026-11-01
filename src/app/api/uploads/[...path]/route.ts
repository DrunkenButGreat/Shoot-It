import { NextRequest, NextResponse } from 'next/server'
import { stat, open, realpath } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { auth } from '@/auth'
import { canReadUpload } from '@/lib/upload-access'
import { generateResultPreview } from '@/lib/image-processing'

function getContentType(filePath: string): string {
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4',
    '.webm': 'video/webm', '.mov': 'video/quicktime',
  }
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path: parts } = await params
    if (!parts.length || parts.some(part => !part || part.startsWith('.') || /[/\\\0]/.test(part))) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    const url = `/api/uploads/${parts.join('/')}`
    const session = await auth()
    if (!await canReadUpload(url, session?.user?.id)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    const root = await realpath(path.join(process.cwd(), 'uploads'))
    const filePath = path.join(root, ...parts)
    // Resolve existing parents before generating a missing preview through a symlink.
    const inside = async (file: string) => {
      const resolved = await realpath(file)
      const relative = path.relative(root, resolved)
      if (!relative || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) {
        throw Object.assign(new Error('Forbidden'), { code: 'EACCES' })
      }
      return resolved
    }
    await inside(path.dirname(filePath) === root ? filePath : path.dirname(filePath))
    try {
      await stat(filePath)
    } catch (error) {
      const filename = path.basename(filePath)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !filename.startsWith('preview_') || !filename.endsWith('.webp')) throw error
      const original = await inside(path.join(path.dirname(filePath), filename.slice(8, -5)))
      await generateResultPreview(original, filePath)
    }
    const resolved = await inside(filePath)
    const handle = await open(resolved, 'r')
    try {
      const info = await handle.stat()
      const { size } = info
      if (!info.isFile()) { await handle.close(); return new NextResponse('Not found', { status: 404 }) }
      let start = 0
      let end = size - 1
      const range = request.headers.get('range')
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range)
        if (!match || (!match[1] && !match[2])) {
          await handle.close()
          return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
        }
        if (!match[1]) start = Math.max(size - Number(match[2]), 0)
        else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end) }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
          await handle.close()
          return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
        }
      }
      const headers: Record<string, string> = {
        'Content-Type': getContentType(resolved), 'Accept-Ranges': 'bytes',
        'Content-Length': String(Math.max(end - start + 1, 0)),
        'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff',
      }
      if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`
      const stream = handle.createReadStream({ ...(size ? { start, end } : {}), autoClose: true, signal: request.signal })
      return new NextResponse(Readable.toWeb(stream) as ReadableStream, { status: range ? 206 : 200, headers })
    } catch (error) { await handle.close(); throw error }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return new NextResponse('File not found', { status: 404 })
    if (code === 'EACCES') return new NextResponse('Forbidden', { status: 403 })
    console.error('Error serving file:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
