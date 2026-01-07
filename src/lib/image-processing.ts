import sharp from 'sharp'
import { appConfig } from '@/config/app.config'
import path from 'path'
import fs from 'fs/promises'

export interface ImageMetadata {
  width: number
  height: number
  size: number
}

export async function generateThumbnail(
  sourcePath: string,
  targetPath: string
): Promise<void> {
  await sharp(sourcePath)
    .resize(
      appConfig.imageProcessing.thumbnailWidth,
      appConfig.imageProcessing.thumbnailHeight,
      {
        fit: 'cover',
        position: 'center',
      }
    )
    .jpeg({ quality: appConfig.imageProcessing.thumbnailQuality })
    .toFile(targetPath)
}

export async function getImageMetadata(filePath: string): Promise<ImageMetadata> {
  const metadata = await sharp(filePath).metadata()
  const stats = await fs.stat(filePath)
  
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    size: stats.size,
  }
}

export async function optimizeImage(
  sourcePath: string,
  targetPath: string,
  quality: number = 85
): Promise<void> {
  const ext = path.extname(sourcePath).toLowerCase()
  
  if (ext === '.png') {
    await sharp(sourcePath)
      .png({ quality, compressionLevel: 9 })
      .toFile(targetPath)
  } else if (ext === '.webp') {
    await sharp(sourcePath)
      .webp({ quality })
      .toFile(targetPath)
  } else {
    // Default to JPEG
    await sharp(sourcePath)
      .jpeg({ quality })
      .toFile(targetPath)
  }
}
