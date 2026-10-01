import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { canEditProject } from '@/lib/permissions'
import { validateUpload, isVideoFile, generateSecureFilename } from '@/lib/file-utils'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string; participantId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return new NextResponse(null, { status: 401 })
  const { id, participantId } = await params
  if (!await canEditProject(session.user.id, id)) return new NextResponse(null, { status: 403 })
  const participant = await prisma.participant.findFirst({ where: { id: participantId, projectId: id } })
  if (!participant) return new NextResponse(null, { status: 404 })

  let target: string | undefined
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File) || isVideoFile(file) || !validateUpload(file, 5 * 1024 * 1024).valid) {
      return new NextResponse(null, { status: 400 })
    }
    const { data, info } = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer({ resolveWithObject: true })
    const filename = generateSecureFilename('portrait.webp')
    const dir = path.join(process.cwd(), 'uploads', 'projects', id, 'participants', participantId)
    await mkdir(dir, { recursive: true })
    target = path.join(dir, filename)
    await writeFile(target, data)
    const image = await prisma.participantImage.create({ data: {
      participantId, filename: file.name,
      path: `/api/uploads/projects/${id}/participants/${participantId}/${filename}`,
      width: info.width, height: info.height, size: data.length,
    } })
    return NextResponse.json(image, { status: 201 })
  } catch {
    if (target) await unlink(target).catch(() => {})
    return new NextResponse(null, { status: 400 })
  }
}
