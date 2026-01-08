import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canEditProject } from "@/lib/permissions"
import { readFile, writeFile, mkdir, readdir } from "fs/promises"
import path from "path"
import { generateSecureFilename } from "@/lib/file-utils"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string, groupId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id: projectId, groupId } = await params

        const canEdit = await canEditProject(session.user.id, projectId)
        if (!canEdit) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        const { folderName } = await request.json()
        if (!folderName) {
            return NextResponse.json({ error: "Folder name is required" }, { status: 400 })
        }

        const localMediaPath = path.join("/app/local_media", folderName)

        if (!localMediaPath.startsWith("/app/local_media")) {
            return NextResponse.json({ error: "Invalid path" }, { status: 400 })
        }

        const entries = await readdir(localMediaPath, { withFileTypes: true })
        const imageFiles = entries.filter(entry => {
            if (!entry.isFile()) return false
            const ext = path.extname(entry.name).toLowerCase()
            return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
        })

        if (imageFiles.length === 0) {
            return NextResponse.json({ error: "No images found" }, { status: 400 })
        }

        const relativeDir = path.join("moodboard", projectId, groupId)
        const uploadDir = path.join(process.cwd(), "uploads", relativeDir)
        await mkdir(uploadDir, { recursive: true })

        const sharp = (await import("sharp")).default
        const importedImages = []

        // Get highest order
        const lastImage = await prisma.moodboardImage.findFirst({
            where: { groupId },
            orderBy: { order: "desc" }
        })
        let currentOrder = (lastImage?.order ?? -1) + 1

        for (const fileItem of imageFiles) {
            const filePath = path.join(localMediaPath, fileItem.name)
            const buffer = await readFile(filePath)

            const secureFilename = generateSecureFilename(fileItem.name)
            const destinationPath = path.join(uploadDir, secureFilename)

            await writeFile(destinationPath, buffer)

            const metadata = await sharp(buffer).metadata()
            const dbPath = `/api/uploads/${relativeDir}/${secureFilename}`.replace(/\\/g, '/')

            const image = await prisma.moodboardImage.create({
                data: {
                    filename: fileItem.name,
                    path: dbPath,
                    groupId: groupId,
                    thumbnail: dbPath,
                    width: metadata.width,
                    height: metadata.height,
                    order: currentOrder++
                }
            })
            importedImages.push(image)
        }

        return NextResponse.json({ count: importedImages.length })

    } catch (error) {
        console.error("Error scanning local media for moodboard:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
