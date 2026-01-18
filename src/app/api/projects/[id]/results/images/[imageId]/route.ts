import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { canEditProject } from "@/lib/permissions"
import { unlink } from "fs/promises"
import path from "path"

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; imageId: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id: projectId, imageId } = await params

        // Check if user has edit access to the project
        const canEdit = await canEditProject(session.user.id, projectId)
        if (!canEdit) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Get image details
        const image = await prisma.resultFile.findUnique({
            where: { id: imageId },
        })

        if (!image) {
            return NextResponse.json({ error: "Image not found" }, { status: 404 })
        }

        // Ensure the image belongs to the project
        if (image.projectId !== projectId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Delete from DB
        await prisma.resultFile.delete({
            where: { id: imageId },
        })

        // Delete from filesystem
        try {
            const relativePath = image.path.replace("/api/uploads/", "")
            const fullPath = path.join(process.cwd(), "uploads", relativePath)
            await unlink(fullPath)

            // Delete thumbnail/preview if it exists and is different from the original
            if (image.thumbnail && image.thumbnail !== image.path) {
                const thumbRelativePath = image.thumbnail.replace("/api/uploads/", "")
                const thumbFullPath = path.join(process.cwd(), "uploads", thumbRelativePath)
                await unlink(thumbFullPath).catch(() => {}) // Ignore if preview doesn't exist
            }
        } catch (fileError) {
            console.error("Failed to delete physical files:", fileError)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting result image:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
