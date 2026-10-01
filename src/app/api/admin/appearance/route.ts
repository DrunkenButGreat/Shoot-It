import { getAdmin } from '@/lib/admin'
import prisma from '@/lib/prisma'
import { getSiteImages } from '@/lib/site-settings'
import { validateUpload, isVideoFile, generateSecureFilename } from '@/lib/file-utils'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const slotSchema = z.enum(['landingImage', 'loginImage', 'signupImage'])

export async function POST(request: Request) {
  if (!await getAdmin()) return new NextResponse(null, { status: 403 })
  try {
    const form = await request.formData()
    const slot = slotSchema.parse(form.get('slot'))
    const file = form.get('file')
    if (!(file instanceof File) || isVideoFile(file) || !validateUpload(file, 5 * 1024 * 1024).valid) {
      return new NextResponse(null, { status: 400 })
    }
    // Decode and re-encode uploads so only actual raster images are published.
    const buffer = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate().resize(2560, 2560, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer()
    const filename = generateSecureFilename('image.webp')
    const dir = path.join(process.cwd(), 'uploads', 'site')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, filename), buffer)
    const data = { [slot]: `/api/uploads/site/${filename}` }
    await prisma.siteSettings.upsert({ where: { id: 'global' }, create: { id: 'global', ...data }, update: data })
    return NextResponse.json(await getSiteImages())
  } catch {
    return new NextResponse(null, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  if (!await getAdmin()) return new NextResponse(null, { status: 403 })
  try {
    const { slot } = z.object({ slot: slotSchema }).parse(await request.json())
    const data = { [slot]: null }
    await prisma.siteSettings.upsert({ where: { id: 'global' }, create: { id: 'global', ...data }, update: data })
    return NextResponse.json(await getSiteImages())
  } catch {
    return new NextResponse(null, { status: 400 })
  }
}
