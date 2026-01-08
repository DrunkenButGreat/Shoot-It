import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canEditProject } from "@/lib/permissions"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { generateSecureFilename, validateUpload } from "@/lib/file-utils"

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

        // Get image metadata
        const sharp = (await import("sharp")).default
        const metadata = await sharp(buffer).metadata()

        // Database record
        const count = await prisma.moodboardImage.count({
            where: { groupId }
        })

        const dbPath = `/api/uploads/${relativeDir}/${secureFilename}`.replace(/\\/g, '/')

        const image = await prisma.moodboardImage.create({
            data: {
                filename: file.name,
                path: dbPath,
                order: count,
                groupId,
                thumbnail: dbPath,
                width: metadata.width,
                height: metadata.height
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
