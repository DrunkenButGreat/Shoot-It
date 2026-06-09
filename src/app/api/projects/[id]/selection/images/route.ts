import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canEditProject } from "@/lib/permissions"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { generateSecureFilename, validateUpload } from "@/lib/file-utils"
import { getImageMetadata, generateResultPreview, generateGridThumbnail } from "@/lib/image-processing"

// In-memory lock for folder creation to prevent race conditions during parallel uploads
const folderCreationLocks = new Map<string, Promise<string | null>>();

async function ensureFolderStructure(projectId: string, relativePath: string) {
    const parts = relativePath.replace(/\\/g, '/').split('/').filter(p => p)
    if (parts.length <= 1) return null // No folders, just filename or flat list

    // Remove filename to get only the folder path
    parts.pop()
    const folderKey = `${projectId}:${parts.join('/')}`;

    if (folderCreationLocks.has(folderKey)) {
        return await folderCreationLocks.get(folderKey)!;
    }

    const creationPromise = (async () => {
        let parentId: string | null = null
        let currentPath = ""

        for (const part of parts) {
            currentPath = `${currentPath}/${part}`
            
            // Try to find existing folder first
            let folder: any = await (prisma.selectionFolder as any).findFirst({
                where: {
                    name: part,
                    projectId,
                    parentId
                }
            })

            if (!folder) {
                try {
                    folder = await (prisma.selectionFolder as any).create({
                        data: {
                            name: part,
                            projectId,
                            parentId,
                            path: currentPath
                        }
                    })
                } catch (e) {
                    // Parallel request might have created it
                    folder = await (prisma.selectionFolder as any).findFirst({
                        where: {
                            name: part,
                            projectId,
                            parentId
                        }
                    })
                    if (!folder) throw new Error(`Failed to ensure folder: ${part}`)
                }
            }
            parentId = folder.id
        }
        return parentId
    })();

    folderCreationLocks.set(folderKey, creationPromise);
    
    try {
        return await creationPromise;
    } finally {
        // Clear lock after a short delay
        setTimeout(() => folderCreationLocks.delete(folderKey), 5000);
    }
}

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

        // Handle folder structure from relativePath if provided
        let folderId = explicitFolderId || null
        if (!folderId && relativePath) {
            folderId = await ensureFolderStructure(id, relativePath)
        }

        // Validate file
        const validation = validateUpload(file)
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 })
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
        let metadata = { width: 0, height: 0 }
        const previewFilename = `preview_${secureFilename}.webp`
        const previewPath = path.join(uploadDir, previewFilename)

        try {
            metadata = await getImageMetadata(imagePath)
            await generateResultPreview(imagePath, previewPath)
            await generateGridThumbnail(imagePath, path.join(uploadDir, `thumb_${secureFilename}.webp`))
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
