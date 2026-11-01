import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canEditProject } from "@/lib/permissions"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { generateSecureFilename, validateUpload, isVideoFile } from "@/lib/file-utils"
import { getImageMetadata, generateResultPreview } from "@/lib/image-processing"

import { ensureFolderStructure } from '@/lib/folders'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params

        // Check if user has edit access to the project
        const canEdit = await canEditProject(session.user.id, id)
        if (!canEdit) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const formData = await request.formData()
        const file = formData.get("file") as File
        const relativePath = formData.get("relativePath") as string | null
        const explicitFolderId = formData.get("folderId") as string | null

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
        }

        const validation = validateUpload(file)
        if (!validation.valid || isVideoFile(file)) {
            return NextResponse.json({ error: validation.error || "Videos are not supported in selections" }, { status: 400 })
        }

        if (explicitFolderId && !await prisma.selectionFolder.findFirst({ where: { id: explicitFolderId, projectId: id } })) {
            return NextResponse.json({ error: "Folder not found" }, { status: 404 })
        }

        // Handle folder structure from relativePath if provided
        let folderId = explicitFolderId || null
        if (!folderId && relativePath) {
            folderId = await ensureFolderStructure('selection', id, relativePath)
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const secureFilename = generateSecureFilename(file.name)
        const relativeDir = path.join("selection", id)
        const uploadDir = path.join(process.cwd(), "uploads", relativeDir)

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true })

        const imagePath = path.join(uploadDir, secureFilename)
        await writeFile(imagePath, buffer)

        // Get image metadata and generate preview
        let metadata: { width: number; height: number; capturedAt: Date | null } = { width: 0, height: 0, capturedAt: null }
        const previewFilename = `preview_${secureFilename}.webp`
        const previewPath = path.join(uploadDir, previewFilename)

        try {
            metadata = await getImageMetadata(imagePath)
            await generateResultPreview(imagePath, previewPath)
        } catch (err) {
            console.error("Error processing selection image:", err)
        }

        const dbPath = `/api/uploads/${relativeDir}/${secureFilename}`.replace(/\\/g, '/')
        const thumbnailPath = `/api/uploads/${relativeDir}/${previewFilename}`.replace(/\\/g, '/')

        const image = await prisma.selectionImage.create({
            data: {
                filename: file.name,
                path: dbPath,
                projectId: id,
                folderId,
                thumbnail: thumbnailPath,
                width: metadata.width,
                height: metadata.height,
                capturedAt: metadata.capturedAt,
                size: file.size
            }
        })

        return NextResponse.json(image)
    } catch (error) {
        console.error("Error uploading selection image:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
