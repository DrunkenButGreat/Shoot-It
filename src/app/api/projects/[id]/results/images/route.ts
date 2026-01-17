import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canEditProject } from "@/lib/permissions"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { generateSecureFilename, validateUpload } from "@/lib/file-utils"
import { appConfig } from "@/config/app.config"

// In-memory lock for folder creation to prevent race conditions during parallel uploads
const folderCreationLocks = new Map<string, Promise<string | null>>();

async function ensureFolderStructure(projectId: string, relativePath: string) {
    const parts = relativePath.replace(/\\/g, '/').split('/').filter(p => p)
    if (parts.length <= 1) return null // No folders, just filename

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
            let folder = await prisma.resultFolder.findFirst({
                where: {
                    name: part,
                    projectId,
                    parentId
                }
            })

            if (!folder) {
                try {
                    folder = await prisma.resultFolder.create({
                        data: {
                            name: part,
                            projectId,
                            parentId,
                            path: currentPath
                        }
                    })
                } catch (e) {
                    // Parallel request might have created it
                    folder = await prisma.resultFolder.findFirst({
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
        // Clear lock after a short delay to allow all parallel requests to finish
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

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
        }

        // Validate file
        const validation = validateUpload(file, appConfig.limits.maxResultsUploadSize)
        if (!validation.valid) {
            return NextResponse.json({ error: validation.error }, { status: 400 })
        }

        // Handle folder structure
        let folderId: string | null = null
        if (relativePath) {
            folderId = await ensureFolderStructure(id, relativePath)
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        const secureFilename = generateSecureFilename(file.name)
        const relativeDir = path.join("results", id, folderId || "root")
        const uploadDir = path.join(process.cwd(), "uploads", relativeDir)

        // Ensure directory exists
        await mkdir(uploadDir, { recursive: true })

        const filePath = path.join(uploadDir, secureFilename)
        await writeFile(filePath, buffer)

        const dbPath = `/api/uploads/${relativeDir}/${secureFilename}`.replace(/\\/g, '/')

        const image = await prisma.resultFile.create({
            data: {
                filename: file.name,
                path: dbPath,
                thumbnail: dbPath,
                size: file.size,
                project: { connect: { id } },
                folder: folderId ? { connect: { id: folderId } } : undefined
            }
        })

        return NextResponse.json(image)
    } catch (error) {
        console.error("Error uploading result image to root:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
