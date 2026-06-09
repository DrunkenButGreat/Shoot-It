import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canEditProject } from "@/lib/permissions"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { generateSecureFilename, validateUpload, isVideoFile } from "@/lib/file-utils"
import { getImageMetadata, generateResultPreview, generateGridThumbnail } from "@/lib/image-processing"
import { getVideoMetadata, generateVideoPoster } from "@/lib/video-processing"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; groupId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id, groupId } = await params

        // Check if user has edit access to the project
        const canEdit = await canEditProject(session.user.id, id)
        if (!canEdit) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Check if group is project-specific or library
        const group = await prisma.moodboardGroup.findUnique({
            where: { id: groupId },
            select: { ownerId: true, isLibrary: true }
        })

        if (!group) {
            return NextResponse.json({ error: "Group not found" }, { status: 404 })
        }

        // If it's a library group, ONLY the owner can add images.
        // If it's a project group (NOT isLibrary), anyone with canEdit can add images.
        if (group.isLibrary && group.ownerId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden: Only the owner can add images to library groups" }, { status: 403 })
        }

        const formData = await request.formData()
        const file = formData.get("file") as File

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
        }

        // Validate file
        const validation = validateUpload(file)
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 })
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const secureFilename = generateSecureFilename(file.name)
        const relativeDir = path.join("moodboard", id, groupId)
        const uploadDir = path.join(process.cwd(), "uploads", relativeDir)

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true })

        const imagePath = path.join(uploadDir, secureFilename)
        await writeFile(imagePath, buffer)

        const isVideo = isVideoFile(file)

        // Get metadata and generate preview/poster
        let metadata: { width: number; height: number; duration?: number } = { width: 0, height: 0 }
        const previewFilename = `preview_${secureFilename}.webp`
        const previewPath = path.join(uploadDir, previewFilename)

        try {
            if (isVideo) {
                metadata = await getVideoMetadata(imagePath)
                await generateVideoPoster(imagePath, previewPath)
            } else {
                metadata = await getImageMetadata(imagePath)
                await generateResultPreview(imagePath, previewPath)
                await generateGridThumbnail(imagePath, path.join(uploadDir, `thumb_${secureFilename}.webp`))
            }
        } catch (err) {
            console.error("Error processing moodboard upload:", err)
        }

        // Database record
        const count = await prisma.moodboardImage.count({
            where: { groupId }
        })

        const dbPath = `/api/uploads/${relativeDir}/${secureFilename}`.replace(/\\/g, '/')
        const thumbnailPath = `/api/uploads/${relativeDir}/${previewFilename}`.replace(/\\/g, '/')

        const image = await prisma.moodboardImage.create({
            data: {
                filename: file.name,
                path: dbPath,
                order: count,
                groupId,
                thumbnail: thumbnailPath,
                width: metadata.width,
                height: metadata.height,
                size: file.size,
                isVideo,
                duration: metadata.duration ?? null
            }
        })

        return NextResponse.json(image)
    } catch (error) {
        console.error("Error uploading moodboard image:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
