import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { validateUpload, generateSecureFilename } from "@/lib/file-utils"

export async function POST(
    request: NextRequest
) {
    const session = await auth()
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 })

    const formData = await request.formData()
    const file = formData.get("file") as File
    
    if (!file) return new NextResponse("No file uploaded", { status: 400 })

    // Validation
    const validation = validateUpload(file, 5 * 1024 * 1024) // 5MB limit
    if (!validation.valid) return new NextResponse(validation.error, { status: 400 })

    try {
        const buffer = Buffer.from(await file.arrayBuffer())
        const filename = generateSecureFilename(file.name)
        
        // Save to uploads/users/[id]/branding/
        const uploadDir = path.join(process.cwd(), "uploads", "users", session.user.id, "branding")
        await mkdir(uploadDir, { recursive: true })
        
        await writeFile(path.join(uploadDir, filename), buffer)
        
        // Public URL 
        const imageUrl = `/api/uploads/users/${session.user.id}/branding/${filename}`

        // Update User
        await prisma.user.update({
            where: { id: session.user.id },
            data: { brandingImage: imageUrl }
        })

        return NextResponse.json({ url: imageUrl })
    } catch (error) {
        console.error("Upload failed", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
