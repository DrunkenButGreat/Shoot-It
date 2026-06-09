import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { generateSecureFilename, validateUpload, isVideoFile } from "@/lib/file-utils"
import { getVideoMetadata, generateVideoPoster } from "@/lib/video-processing"
import { generateGridThumbnail } from "@/lib/image-processing"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id: groupId } = await params

        // Check ownership
        const group = await prisma.moodboardGroup.findUnique({
            where: { id: groupId },
            select: { ownerId: true }
        })

        if (!group || group.ownerId !== session.user.id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const formData = await request.formData()
        const file = formData.get("file") as File

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
        }

        const validation = validateUpload(file)
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 })
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const secureFilename = generateSecureFilename(file.name)
        // Store in a user-specific folder for consistency
        const relativeDir = path.join("moodboard", `user_${session.user.id}`, groupId)
        const uploadDir = path.join(process.cwd(), "uploads", relativeDir)

        await mkdir(uploadDir, { recursive: true })

        const imagePath = path.join(uploadDir, secureFilename)
        await writeFile(imagePath, buffer)

        const isVideo = isVideoFile(file)
        const dbPath = `/api/uploads/${relativeDir}/${secureFilename}`.replace(/\\/g, '/')

        let width: number | undefined
        let height: number | undefined
        let duration: number | null = null
        let thumbnail = dbPath

        try {
            if (isVideo) {
                const meta = await getVideoMetadata(imagePath)
                width = meta.width
                height = meta.height
                duration = meta.duration
                const previewFilename = `preview_${secureFilename}.webp`
                await generateVideoPoster(imagePath, path.join(uploadDir, previewFilename))
                thumbnail = `/api/uploads/${relativeDir}/${previewFilename}`.replace(/\\/g, '/')
            } else {
                const sharp = (await import("sharp")).default
                const metadata = await sharp(buffer).metadata()
                width = metadata.width
                height = metadata.height
                await generateGridThumbnail(imagePath, path.join(uploadDir, `thumb_${secureFilename}.webp`))
            }
        } catch (err) {
            console.error("Error processing moodboard upload:", err)
        }

        const count = await prisma.moodboardImage.count({
            where: { groupId }
        })

        const image = await prisma.moodboardImage.create({
            data: {
                filename: file.name,
                path: dbPath,
                order: count,
                groupId,
                thumbnail,
                width,
                height,
                isVideo,
                duration
            }
        })

        return NextResponse.json(image)
    } catch (error) {
        console.error("Error uploading moodboard image:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
