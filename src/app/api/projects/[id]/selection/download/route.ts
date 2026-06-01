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
      select: { isPublic: true, showSelectionPublicly: true, allowSelectionDownload: true }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Public download is only allowed when the selection is public AND download is explicitly enabled.
    const isPublicAccess = project.isPublic && project.showSelectionPublicly && project.allowSelectionDownload;

    if (session?.user?.id) {
      // Authenticated users with access can always download.
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

    // Fetch all selection folders to build the directory structure inside the zip.
    const folders = await prisma.selectionFolder.findMany({
      where: { projectId },
    });
    const folderMap = new Map(folders.map(f => [f.id, f]));

    const getFolderPath = (folderId: string): string => {
      const folder = folderMap.get(folderId);
      if (!folder) return '';
      if (folder.parentId) {
        return path.join(getFolderPath(folder.parentId), folder.name);
      }
      return folder.name;
    };

    const isFolderSelectedRecursively = (folderId: string | null): boolean => {
      if (!folderId) return false;
      if (folderIds.includes(folderId)) return true;
      const folder = folderMap.get(folderId);
      if (folder?.parentId) {
        return isFolderSelectedRecursively(folder.parentId);
      }
      return false;
    };

    const explicitImages = await prisma.selectionImage.findMany({
      where: { id: { in: imageIds } },
    });

    const allProjectImages = await prisma.selectionImage.findMany({
      where: { projectId },
    });

    const finalImagesToInclude = new Map<string, any>();
    explicitImages.forEach(img => finalImagesToInclude.set(img.id, img));
    allProjectImages.forEach(img => {
      if (img.folderId && isFolderSelectedRecursively(img.folderId)) {
        finalImagesToInclude.set(img.id, img);
      }
    });

    if (finalImagesToInclude.size === 0) {
      return NextResponse.json({ error: 'No images found in selection' }, { status: 404 });
    }

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    const stream = new ReadableStream({
      start(controller) {
        archive.on('data', (chunk) => controller.enqueue(chunk));
        archive.on('end', () => controller.close());
        archive.on('error', (err) => controller.error(err));

        finalImagesToInclude.forEach((image) => {
          const relativePath = image.path.replace('/api/uploads/', '');
          const fullPath = path.join(process.cwd(), 'uploads', relativePath);

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
        'Content-Disposition': `attachment; filename="selection_${projectId}.zip"`,
      },
    });
  } catch (error) {
    console.error('Error creating selection ZIP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
