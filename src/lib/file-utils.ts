import { appConfig } from '@/config/app.config'
import path from 'path'
import crypto from 'crypto'

export function validateUpload(file: File): { valid: boolean; error?: string } {
  // Größenprüfung
  if (file.size > appConfig.limits.maxUploadSize) {
    return { 
      valid: false, 
      error: `File too large (max. ${appConfig.limits.maxUploadSize / 1024 / 1024}MB)` 
    }
  }
  
  // Typ-Prüfung
  const ext = path.extname(file.name).toLowerCase().slice(1)
  if (!appConfig.imageProcessing.supportedFormats.includes(ext)) {
    return { valid: false, error: `Format not supported: ${ext}` }
  }
  
  // MIME-Type Prüfung
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/webp', 
    'image/gif', 'image/tiff', 'image/heic'
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
