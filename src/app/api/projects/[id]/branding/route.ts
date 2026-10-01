import { z } from "zod"
import { generateResultPreview } from "@/lib/image-processing"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { writeFile, mkdir, realpath } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { validateUpload, generateSecureFilename } from "@/lib/file-utils"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 })

    // Check ownership
    const project = await prisma.project.findUnique({
        where: { id, ownerId: session.user.id }
    })
    if (!project) return new NextResponse("Project not found", { status: 404 })

    const formData = await request.formData()
    const file = formData.get("file") as File
    
    if (!file) return new NextResponse("No file uploaded", { status: 400 })

    // Validation
    const validation = validateUpload(file, 5 * 1024 * 1024) // 5MB limit
    if (!validation.valid) return new NextResponse(validation.error, { status: 400 })

    try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = generateSecureFilename(file.name)
        
        // Save to uploads/projects/[id]/branding/
        const uploadDir = path.join(process.cwd(), "uploads", "projects", id, "branding")
        await mkdir(uploadDir, { recursive: true })
        
        await writeFile(path.join(uploadDir, filename), buffer)
        
        // Public URL 
        const imageUrl = `/api/uploads/projects/${id}/branding/${filename}`

        // Update Project
        await prisma.project.update({
            where: { id },
            data: { brandingImage: imageUrl }
        })

        return NextResponse.json({ url: imageUrl })
    } catch (error) {
        console.error("Upload failed", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}

const sourceSchema = z.enum(['moodboard', 'selection', 'results'])
const imageSelect = { id: true, filename: true, path: true, thumbnail: true } as const

async function projectImages(projectId: string, source: z.infer<typeof sourceSchema>, imageId?: string, page = 0) {
    const pagination = { skip: imageId ? 0 : page * 48, take: imageId ? 1 : 49 }
    if (source === 'moodboard') return prisma.moodboardImage.findMany({
        where: { id: imageId, isVideo: false, group: { projectLinks: { some: { projectId } } } },
        select: imageSelect, orderBy: [{ order: 'asc' }, { id: 'asc' }], ...pagination,
    })
    if (source === 'selection') return prisma.selectionImage.findMany({
        where: { id: imageId, projectId }, select: imageSelect, orderBy: { id: 'asc' }, ...pagination,
    })
    return prisma.resultFile.findMany({
        where: { id: imageId, projectId, isVideo: false }, select: imageSelect, orderBy: { id: 'asc' }, ...pagination,
    })
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) return new NextResponse(null, { status: 401 })
    const { id } = await params
    if (!await prisma.project.findFirst({ where: { id, ownerId: session.user.id } })) return new NextResponse(null, { status: 404 })
    const input = z.object({ source: sourceSchema, page: z.coerce.number().int().min(0).max(100000).default(0) })
        .safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!input.success) return new NextResponse(null, { status: 400 })
    const images = await projectImages(id, input.data.source, undefined, input.data.page)
    return NextResponse.json({ images: images.slice(0, 48), hasMore: images.length > 48 }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) return new NextResponse(null, { status: 401 })
    const { id } = await params
    if (!await prisma.project.findFirst({ where: { id, ownerId: session.user.id } })) return new NextResponse(null, { status: 404 })
    try {
        const input = z.object({ source: sourceSchema, imageId: z.string().min(1).max(200) }).parse(await request.json())
        const [image] = await projectImages(id, input.source, input.imageId)
        if (!image) return new NextResponse(null, { status: 404 })
        if (!image.path.startsWith('/api/uploads/')) return new NextResponse(null, { status: 400 })
        const root = await realpath(path.join(process.cwd(), 'uploads'))
        const source = await realpath(path.join(root, image.path.slice('/api/uploads/'.length)))
        const relative = path.relative(root, source)
        if (path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) return new NextResponse(null, { status: 400 })
        // Keep a separate cover so deleting the source image cannot break it.
        const filename = generateSecureFilename('cover.webp')
        const dir = path.join(root, 'projects', id, 'branding')
        await mkdir(dir, { recursive: true })
        await generateResultPreview(source, path.join(dir, filename))
        const url = `/api/uploads/projects/${id}/branding/${filename}`
        await prisma.project.update({ where: { id }, data: { brandingImage: url } })
        return NextResponse.json({ url })
    } catch {
        return new NextResponse(null, { status: 400 })
    }
}
