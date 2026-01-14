import { NextRequest, NextResponse } from "next/server"
import { readdir } from "fs/promises"
import { auth } from "@/auth"

export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // This path is defined in docker-compose as a bind mount
    const localMediaPath = "/app/local_media"

    try {
        const entries = await readdir(localMediaPath, { withFileTypes: true })
        // Filter for directories and sort them
        const folders = entries
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)
            .sort((a, b) => a.localeCompare(b))

        return NextResponse.json({ folders })
    } catch (error) {
        // If directory doesn't exist or is not readable, just return empty list
        // This is safe because LOCAL_MEDIA_PATH is optional
        return NextResponse.json({ folders: [] })
    }
}
