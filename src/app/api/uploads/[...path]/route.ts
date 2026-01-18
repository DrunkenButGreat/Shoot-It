import { NextRequest, NextResponse } from "next/server"
import { readFile, stat } from "fs/promises"
import path from "path"
import { auth } from "@/auth"
import { generateResultPreview } from "@/lib/image-processing"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathParts } = await params
        const relativePath = path.join(...pathParts)
        console.log(`[UploadServer] Requesting: ${relativePath}`)

        // Path traversal protection
        if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.startsWith('\\')) {
            console.error(`[UploadServer] Forbidden path: ${relativePath}`)
            return new NextResponse("Forbidden", { status: 403 })
        }

        const uploadsDir = path.join(process.cwd(), "uploads")
        const filePath = path.join(uploadsDir, relativePath)
        
        // Handle on-the-fly preview generation
        const filename = path.basename(filePath)
        if (filename.startsWith('preview_') && filename.endsWith('.webp')) {
            try {
                // Check if already exists using stat instead of readFile
                await stat(filePath)
                console.log(`[UploadServer] Preview exists: ${filename}`)
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    console.log(`[UploadServer] Preview missing, generating for: ${filename}`)
                    
                    // Extract basename: preview_123.jpg.webp -> 123.jpg
                    const basename = filename.slice('preview_'.length, filename.lastIndexOf('.webp'))
                    const dir = path.dirname(filePath)
                    
                    let originalPath = null
                    const directPath = path.join(dir, basename)
                    
                    try {
                        await stat(directPath)
                        originalPath = directPath
                    } catch (e) {
                        // Try common extensions if direct didn't work
                        const nameWithoutExt = path.parse(basename).name
                        const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.heic', '.HEIC', '.JPG', '.PNG']
                        
                        for (const ext of extensions) {
                            const potentialPath = path.join(dir, nameWithoutExt + ext)
                            try {
                                await stat(potentialPath)
                                originalPath = potentialPath
                                break
                            } catch (e) {}
                        }
                    }

                    if (originalPath) {
                        try {
                            await generateResultPreview(originalPath, filePath)
                            console.log(`[PreviewGen] Success: ${path.basename(originalPath)} -> ${filename}`)
                        } catch (genError) {
                            console.error(`[PreviewGen] Failed to generate:`, genError)
                            // IMPORTANT: Fallback to original if generation fails
                            console.log(`[PreviewGen] Falling back to original: ${originalPath}`)
                            return await serveFile(originalPath)
                        }
                    } else {
                        console.warn(`[PreviewGen] Original not found for: ${filename} (tried basename: ${basename})`)
                        // If it's a preview request and we can't find original, we still can't serve anything
                        return new NextResponse("Original not found", { status: 404 })
                    }
                } else {
                    throw error
                }
            }
        }

        return await serveFile(filePath)

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.error(`[UploadServer] File not found: ${error.path}`)
            return new NextResponse("File not found", { status: 404 })
        }
        console.error("[UploadServer] Error serving file:", error)
        return new NextResponse("Internal server error", { status: 500 })
    }
}

async function serveFile(filePath: string) {
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
}

