import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { validateUpload, generateSecureFilename } from "@/lib/file-utils"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 })

    // Check ownership
    const project = await prisma.project.findUnique({
        where: { id, ownerId: session.user.id }
    })
    if (!project) return new NextResponse("Project not found", { status: 404 })

    const formData = await request.formData()
    const file = formData.get("file") as File
    
    if (!file) return new NextResponse("No file uploaded", { status: 400 })

    // Validation
    const validation = validateUpload(file, 5 * 1024 * 1024) // 5MB limit
    if (!validation.valid) return new NextResponse(validation.error, { status: 400 })

    try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = generateSecureFilename(file.name)
        
        // Save to uploads/projects/[id]/branding/
        const uploadDir = path.join(process.cwd(), "uploads", "projects", id, "branding")
        await mkdir(uploadDir, { recursive: true })
        
        await writeFile(path.join(uploadDir, filename), buffer)
        
        // Public URL 
        const imageUrl = `/api/uploads/projects/${id}/branding/${filename}`

        // Update Project
        await prisma.project.update({
            where: { id },
            data: { brandingImage: imageUrl }
        })

        return NextResponse.json({ url: imageUrl })
    } catch (error) {
        console.error("Upload failed", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
