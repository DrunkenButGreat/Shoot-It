import { NextRequest, NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"
import { auth } from "@/auth"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathParts } = await params
        const relativePath = path.join(...pathParts)

        // Path traversal protection
        if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.startsWith('\\')) {
            return new NextResponse("Forbidden", { status: 403 })
        }

        const filePath = path.join(process.cwd(), "uploads", relativePath)
        const fileBuffer = await readFile(filePath)

        // Determine content type
        const ext = path.extname(filePath).toLowerCase()
        let contentType = "application/octet-stream"
        if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg"
        else if (ext === ".png") contentType = "image/png"
        else if (ext === ".webp") contentType = "image/webp"
        else if (ext === ".gif") contentType = "image/gif"

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        })
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return new NextResponse("File not found", { status: 404 })
        }
        console.error("Error serving file:", error)
        return new NextResponse("Internal server error", { status: 500 })
    }
}
