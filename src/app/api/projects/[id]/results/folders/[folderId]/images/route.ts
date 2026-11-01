import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canEditProject } from "@/lib/permissions"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { generateSecureFilename, validateUpload, isVideoFile } from "@/lib/file-utils"
import { appConfig } from "@/config/app.config"
import { getImageMetadata, generateResultPreview } from "@/lib/image-processing"
import { getVideoMetadata, generateVideoPoster } from "@/lib/video-processing"

import { ensureFolderStructure } from '@/lib/folders'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; folderId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id, folderId } = await params

        // Check if user has edit access to the project
        const canEdit = await canEditProject(session.user.id, id)
        if (!canEdit) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const target = await prisma.resultFolder.findFirst({ where: { id: folderId, projectId: id } })
        if (!target) return NextResponse.json({ error: "Folder not found" }, { status: 404 })

        const formData = await request.formData()
        const file = formData.get("file") as File
        const relativePath = formData.get("relativePath") as string | null

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
        }

        // Validate file
        const validation = validateUpload(file, appConfig.limits.maxResultsUploadSize)
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 })
        }

        // Handle subfolder structure
        let targetFolderId = folderId
        if (relativePath) {
            targetFolderId = (await ensureFolderStructure('results', id, relativePath, folderId))!
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const secureFilename = generateSecureFilename(file.name)
        const relativeDir = path.join("results", id, targetFolderId)
        const uploadDir = path.join(process.cwd(), "uploads", relativeDir)

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true })

        const filePath = path.join(uploadDir, secureFilename)
        await writeFile(filePath, buffer)
        console.log(`[UploadAPI] Original saved to: ${filePath}`)

        const isVideo = isVideoFile(file)

        // Generate metadata and preview/poster
        let metadata: { width: number; height: number; duration?: number } = { width: 0, height: 0 }
        const previewFilename = `preview_${secureFilename}.webp`
        const previewPath = path.join(uploadDir, previewFilename)
        console.log(`[UploadAPI] Target preview path: ${previewPath}`)

        try {
            if (isVideo) {
                metadata = await getVideoMetadata(filePath)
                await generateVideoPoster(filePath, previewPath)
            } else {
                metadata = await getImageMetadata(filePath)
                await generateResultPreview(filePath, previewPath)
            }
            console.log(`[UploadAPI] Metadata & Preview generated successfully`)
        } catch (err) {
            console.error("[UploadAPI] Error processing upload:", err)
        }

        const dbPath = `/api/uploads/${relativeDir}/${secureFilename}`.replace(/\\/g, '/')
        const thumbnailPath = `/api/uploads/${relativeDir}/${previewFilename}`.replace(/\\/g, '/')

        const image = await prisma.resultFile.create({
            data: {
                filename: file.name,
                path: dbPath,
                thumbnail: thumbnailPath,
                width: metadata.width,
                height: metadata.height,
                size: file.size,
                isVideo,
                duration: metadata.duration ?? null,
                project: { connect: { id } },
                folder: { connect: { id: targetFolderId } }
            }
        })

        return NextResponse.json(image)
    } catch (error) {
        console.error("Error uploading result image:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

