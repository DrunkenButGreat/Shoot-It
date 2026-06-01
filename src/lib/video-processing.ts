import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'
import sharp from 'sharp'
import { appConfig } from '@/config/app.config'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import fs from 'fs/promises'

// Point fluent-ffmpeg at the bundled static binaries so we don't depend on a
// system ffmpeg install (works inside the Docker image too).
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string)
}
ffmpeg.setFfprobePath(ffprobeStatic.path)

export interface VideoMetadata {
  width: number
  height: number
  duration: number
}

export async function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err)
        return
      }
      const stream = data.streams.find((s) => s.codec_type === 'video')
      resolve({
        width: stream?.width || 0,
        height: stream?.height || 0,
        duration: data.format?.duration || 0,
      })
    })
  })
}

/**
 * Extracts a single frame from the video and writes it as a WebP poster at
 * `targetPath`, using the same sizing/quality as image previews so it blends
 * into the existing galleries.
 */
export async function generateVideoPoster(
  sourcePath: string,
  targetPath: string
): Promise<void> {
  // Pick a timestamp ~1s in (or earlier for very short clips) for a meaningful frame.
  let seek = 1
  try {
    const { duration } = await getVideoMetadata(sourcePath)
    if (duration && duration < 2) {
      seek = Math.max(0, duration / 2)
    }
  } catch {
    // Fall back to the default seek if probing fails.
  }

  const tmpFrame = path.join(
    os.tmpdir(),
    `frame-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.png`
  )

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(sourcePath)
        .seekInput(seek)
        .frames(1)
        .output(tmpFrame)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run()
    })

    await sharp(tmpFrame)
      .resize(
        appConfig.imageProcessing.resultsPreviewMaxWidth,
        appConfig.imageProcessing.resultsPreviewMaxHeight,
        {
          fit: 'inside',
          withoutEnlargement: true,
        }
      )
      .webp({ quality: appConfig.imageProcessing.resultsPreviewQuality })
      .toFile(targetPath)
  } finally {
    await fs.unlink(tmpFrame).catch(() => {})
  }
}
