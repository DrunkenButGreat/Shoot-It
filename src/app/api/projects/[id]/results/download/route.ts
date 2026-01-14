import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { canAccessProject } from '@/lib/permissions';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { isPublic: true, showResultsPublicly: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const isPublicAccess = project.isPublic && project.showResultsPublicly;

    if (!session?.user?.id && !isPublicAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can access this project
    if (session?.user?.id) {
        const canAccess = await canAccessProject(session.user.id, projectId);
        if (!canAccess && !isPublicAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    } else if (!isPublicAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { imageIds = [], folderIds = [] } = await request.json();

    if (imageIds.length === 0 && folderIds.length === 0) {
        return NextResponse.json({ error: 'No items selected' }, { status: 400 });
    }

    // Fetch all folders to build structure
    const folders = await prisma.resultFolder.findMany({
        where: { projectId },
    });

    // Create a map for easy lookup
    const folderMap = new Map(folders.map(f => [f.id, f]));

    // Helper to get full folder path
    const getFolderPath = (folderId: string): string => {
        const folder = folderMap.get(folderId);
        if (!folder) return '';
        if (folder.parentId) {
            return path.join(getFolderPath(folder.parentId), folder.name);
        }
        return folder.name;
    };

    // 1. Get explicit images
    const explicitImages = await prisma.resultFile.findMany({
        where: { id: { in: imageIds } },
        include: { folder: true }
    });

    // 2. Get images from selected folders (including subfolders recursive)
    // We fetch all images of the project and then filter them based on their folder hierarchy
    const allProjectImages = await prisma.resultFile.findMany({
        where: { projectId },
        include: { folder: true }
    });

    const isFolderSelectedRecursively = (folderId: string | null): boolean => {
        if (!folderId) return false;
        if (folderIds.includes(folderId)) return true;
        const folder = folderMap.get(folderId);
        if (folder?.parentId) {
            return isFolderSelectedRecursively(folder.parentId);
        }
        return false;
    };

    const finalImagesToInclude = new Map<string, any>();
    
    // Add explicit images
    explicitImages.forEach(img => finalImagesToInclude.set(img.id, img));
    
    // Add images from selected folders
    allProjectImages.forEach(img => {
        if (img.folderId && isFolderSelectedRecursively(img.folderId)) {
            finalImagesToInclude.set(img.id, img);
        }
    });

    if (finalImagesToInclude.size === 0) {
        return NextResponse.json({ error: 'No images found in selection' }, { status: 404 });
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
                    const zipPath = image.folderId 
                        ? path.join(getFolderPath(image.folderId), image.filename)
                        : image.filename;
                    
                    archive.file(fullPath, { name: zipPath });
                }
            });

            archive.finalize();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="results_${projectId}.zip"`,
        },
    });

  } catch (error) {
    console.error('Error creating ZIP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
