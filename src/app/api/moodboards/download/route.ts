import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import path from 'path';
import { archiveResponse } from '@/lib/zip';

export async function POST(
  request: NextRequest
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const { imageIds = [], groupIds = [], mode } = await request.json();

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

    // Build file list — organized as "Group Name / Filename".
    const items = Array.from(finalImagesToInclude.values()).map((image) => ({
        image,
        relativePath: path.join(image.group.name, image.filename),
    }));

    // Manifest mode: return the file list for client-side direct download.
    if (mode === 'manifest') {
        return NextResponse.json({
            files: items.map(({ image, relativePath }) => ({
                url: image.path,
                relativePath: relativePath.split(path.sep).join('/'),
            })),
        });
    }

    const files = items.map(({ image, relativePath }) => ({
        fullPath: path.join(process.cwd(), 'uploads', image.path.replace('/api/uploads/', '')),
        name: relativePath,
    }));

    return archiveResponse(files, 'moodboard_export.zip');

  } catch (error) {
    console.error('Error creating Moodboard ZIP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
