import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { canAccessProject } from '@/lib/permissions';
import path from 'path';
import { archiveResponse } from '@/lib/zip';

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

    const { imageIds = [], folderIds = [], mode } = await request.json();

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

    // Build file list with relative (zip / on-disk) paths preserving folder structure.
    const items = Array.from(finalImagesToInclude.values()).map((image) => {
      const relativePath = image.folderId
        ? path.join(getFolderPath(image.folderId), image.filename)
        : image.filename;
      return { image, relativePath };
    });

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

    return archiveResponse(files, `selection_${projectId}.zip`);
  } catch (error) {
    console.error('Error creating selection ZIP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
