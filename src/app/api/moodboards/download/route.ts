import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';

export async function POST(
  request: NextRequest
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { imageIds = [], groupIds = [] } = await request.json();

    if (imageIds.length === 0 && groupIds.length === 0) {
        return NextResponse.json({ error: 'No items selected' }, { status: 400 });
    }

    // 1. Get explicit images and their groups to check ownership
    const explicitImages = await prisma.moodboardImage.findMany({
        where: { id: { in: imageIds } },
        include: { group: true }
    });

    // 2. Get images from selected groups
    const groupImages = await prisma.moodboardImage.findMany({
        where: { groupId: { in: groupIds } },
        include: { group: true }
    });

    const finalImagesToInclude = new Map<string, any>();
    
    // Add explicit images if owned
    explicitImages.forEach(img => {
        if (img.group.ownerId === userId) {
            finalImagesToInclude.set(img.id, img);
        }
    });
    
    // Add images from selected groups if owned
    groupImages.forEach(img => {
        if (img.group.ownerId === userId) {
            finalImagesToInclude.set(img.id, img);
        }
    });

    if (finalImagesToInclude.size === 0) {
        return NextResponse.json({ error: 'No images found or access denied' }, { status: 403 });
    }

    // Create ZIP
    const archive = archiver('zip', {
        zlib: { level: 9 } // Highest compression
    });

    // Custom Response with stream
    const stream = new ReadableStream({
        start(controller) {
            archive.on('data', (chunk) => controller.enqueue(chunk));
            archive.on('end', () => controller.close());
            archive.on('error', (err) => controller.error(err));
            
            // Add files to archive
            finalImagesToInclude.forEach((image) => {
                const relativePath = image.path.replace("/api/uploads/", "");
                const fullPath = path.join(process.cwd(), "uploads", relativePath);
                
                if (fs.existsSync(fullPath)) {
                    // Organization in ZIP: Group Name / Filename
                    const zipPath = path.join(image.group.name, image.filename);
                    archive.file(fullPath, { name: zipPath });
                }
            });

            archive.finalize();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="moodboard_export.zip"`,
        },
    });

  } catch (error) {
    console.error('Error creating Moodboard ZIP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
