import { NextRequest, NextResponse } from "next/server"
import { readFile, stat, open } from "fs/promises"
import path from "path"
import { auth } from "@/auth"
import { generateResultPreview, generateGridThumbnail } from "@/lib/image-processing"

function getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
    if (ext === ".png") return "image/png"
    if (ext === ".webp") return "image/webp"
    if (ext === ".gif") return "image/gif"
    if (ext === ".mp4") return "video/mp4"
    if (ext === ".webm") return "video/webm"
    if (ext === ".mov") return "video/quicktime"
    return "application/octet-stream"
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathParts } = await params
        const relativePath = path.join(...pathParts)

        // Path traversal protection
        if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.startsWith('\\')) {
            console.error(`[UploadServer] Forbidden path: ${relativePath}`)
            return new NextResponse("Forbidden", { status: 403 })
        }

        const uploadsDir = path.join(process.cwd(), "uploads")
        const filePath = path.join(uploadsDir, relativePath)
        
        // Handle on-the-fly derivative generation (preview_ = 2560px lightbox,
        // thumb_ = small grid thumbnail). Both are derived from the original and
        // backfill on first request, so pre-update uploads work without a migration.
        const filename = path.basename(filePath)
        const prefix = filename.startsWith('preview_')
            ? 'preview_'
            : filename.startsWith('thumb_')
                ? 'thumb_'
                : null
        if (prefix && filename.endsWith('.webp')) {
            const generate = prefix === 'preview_' ? generateResultPreview : generateGridThumbnail
            try {
                // Check if already exists using stat instead of readFile
                await stat(filePath)
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    // Extract basename: thumb_123.jpg.webp -> 123.jpg
                    const basename = filename.slice(prefix.length, filename.lastIndexOf('.webp'))
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
                            await generate(originalPath, filePath)
                        } catch (genError) {
                            console.error(`[DerivativeGen] Failed to generate ${filename}:`, genError)
                            // IMPORTANT: Fallback to original if generation fails
                            return await serveFile(originalPath, request)
                        }
                    } else {
                        console.warn(`[DerivativeGen] Original not found for: ${filename} (tried basename: ${basename})`)
                        return new NextResponse("Original not found", { status: 404 })
                    }
                } else {
                    throw error
                }
            }
        }

        return await serveFile(filePath, request)

    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.error(`[UploadServer] File not found: ${error.path}`)
            return new NextResponse("File not found", { status: 404 })
        }
        console.error("[UploadServer] Error serving file:", error)
        return new NextResponse("Internal server error", { status: 500 })
    }
}

async function serveFile(filePath: string, request: NextRequest) {
    const contentType = getContentType(filePath)
    const { size } = await stat(filePath)
    const rangeHeader = request.headers.get("range")

    // HTTP Range support — required for <video> seeking.
    if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)
        if (match) {
            const start = match[1] ? parseInt(match[1], 10) : 0
            const end = Math.min(match[2] ? parseInt(match[2], 10) : size - 1, size - 1)

            if (start > end || start >= size) {
                return new NextResponse("Range Not Satisfiable", {
                    status: 416,
                    headers: { "Content-Range": `bytes */${size}` },
                })
            }

            const chunkSize = end - start + 1
            const fh = await open(filePath, "r")
            try {
                const buffer = Buffer.alloc(chunkSize)
                await fh.read(buffer, 0, chunkSize, start)
                return new NextResponse(buffer, {
                    status: 206,
                    headers: {
                        "Content-Type": contentType,
                        "Content-Range": `bytes ${start}-${end}/${size}`,
                        "Accept-Ranges": "bytes",
                        "Content-Length": String(chunkSize),
                        "Cache-Control": "public, max-age=31536000, immutable",
                    },
                })
            } finally {
                await fh.close()
            }
        }
    }

    const fileBuffer = await readFile(filePath)
    return new NextResponse(fileBuffer, {
        headers: {
            "Content-Type": contentType,
            "Accept-Ranges": "bytes",
            "Content-Length": String(size),
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    })
}

