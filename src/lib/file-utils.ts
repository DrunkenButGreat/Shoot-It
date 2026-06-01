import { appConfig } from '@/config/app.config'
import path from 'path'
import crypto from 'crypto'

const videoMimes = [
  'video/mp4', 'video/webm', 'video/quicktime'
]

// Erkennt Videos anhand Extension oder MIME-Type
export function isVideoFile(file: File): boolean {
  const ext = path.extname(file.name).toLowerCase().slice(1)
  return (
    (appConfig.imageProcessing.videoFormats as readonly string[]).includes(ext) ||
    videoMimes.includes(file.type) ||
    file.type.startsWith('video/')
  )
}

export function validateUpload(file: File, maxSize?: number): { valid: boolean; error?: string } {
  const isVideo = isVideoFile(file)

  // Größenprüfung — Videos haben ihr eigenes Limit
  const limit = isVideo
    ? appConfig.limits.maxVideoUploadSize
    : (maxSize || appConfig.limits.maxUploadSize)
  if (file.size > limit) {
    return {
      valid: false,
      error: `File too large (max. ${limit / 1024 / 1024}MB)`
    }
  }

  // Typ-Prüfung (Bild- oder Video-Format)
  const ext = path.extname(file.name).toLowerCase().slice(1)
  const allowedExts = [
    ...appConfig.imageProcessing.supportedFormats,
    ...appConfig.imageProcessing.videoFormats,
  ] as readonly string[]
  if (!allowedExts.includes(ext)) {
    return { valid: false, error: `Format not supported: ${ext}` }
  }

  // MIME-Type Prüfung
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/webp',
    'image/gif', 'image/tiff', 'image/heic',
    ...videoMimes
  ]
  if (!allowedMimes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' }
  }

  return { valid: true }
}

export function generateSecureFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase()
  const hash = crypto.randomBytes(16).toString('hex')
  const timestamp = Date.now()
  return `${timestamp}-${hash}${ext}`
}

// Path Traversal Prevention
export function sanitizePath(inputPath: string, basePath: string): string | null {
  const resolved = path.resolve(basePath, inputPath)
  if (!resolved.startsWith(path.resolve(basePath))) {
    return null // Path traversal attempt
  }
  return resolved
}

export function isPathSafe(inputPath: string): boolean {
  // Verhindere Path Traversal
  const dangerous = ['..', '~', '$', '|', ';', '&', '>', '<', '`']
  return !dangerous.some(char => inputPath.includes(char))
}
