import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { unlink } from "fs/promises"
import path from "path"

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth()
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { imageIds } = await request.json()

        if (!Array.isArray(imageIds) || imageIds.length === 0) {
            return NextResponse.json({ error: "No image IDs provided" }, { status: 400 })
        }

        // Fetch images to check ownership and get paths
        const images = await prisma.moodboardImage.findMany({
            where: {
                id: { in: imageIds },
            },
            include: {
                group: true,
            },
        })

        if (images.length === 0) {
            return NextResponse.json({ error: "No images found" }, { status: 404 })
        }

        const userId = session.user.id

        // Only the owner of the group can delete images
        const unauthorizedIds = images.filter(img => img.group.ownerId !== userId).map(img => img.id)
        
        if (unauthorizedIds.length > 0) {
            return NextResponse.json({ error: "Forbidden: You don't own some of these images" }, { status: 403 })
        }

        // Delete from DB
        await prisma.moodboardImage.deleteMany({
            where: {
                id: { in: imageIds },
            },
        })

        // Delete from filesystem
        for (const image of images) {
            try {
                const relativePath = image.path.replace("/api/uploads/", "")
                const fullPath = path.join(process.cwd(), "uploads", relativePath)
                await unlink(fullPath)
                
                // Also delete thumbnail if it's different
                if (image.thumbnail && image.thumbnail !== image.path) {
                    const thumbRelativePath = image.thumbnail.replace("/api/uploads/", "")
                    const thumbFullPath = path.join(process.cwd(), "uploads", thumbRelativePath)
                    await unlink(thumbFullPath)
                }
            } catch (fileError) {
                console.error(`Failed to delete physical file for image ${image.id}:`, fileError)
            }
        }

        return NextResponse.json({ success: true, count: images.length })
    } catch (error) {
        console.error("Error deleting moodboard images:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
