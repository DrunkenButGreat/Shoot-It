import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { generateSecureFilename, validateUpload } from "@/lib/file-utils"

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

        const sharp = (await import("sharp")).default
        const metadata = await sharp(buffer).metadata()

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
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
