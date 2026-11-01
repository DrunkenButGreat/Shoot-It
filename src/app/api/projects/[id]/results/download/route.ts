import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { canAccessProject } from '@/lib/permissions';
import path from 'path';
import { archiveResponse } from '@/lib/zip';
import { z } from 'zod';

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

    const parsed = z.object({
      imageIds: z.array(z.string()).default([]),
      folderIds: z.array(z.string()).default([]),
      mode: z.enum(['manifest']).optional(),
    }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid selection' }, { status: 400 });
    const { imageIds, folderIds, mode } = parsed.data;

    if (imageIds.length === 0 && folderIds.length === 0) {
        return NextResponse.json({ error: 'No items selected' }, { status: 400 });
    }

    // Fetch all folders to build structure
    const folders = await prisma.resultFolder.findMany({
        where: { projectId },
      select: { id: true, parentId: true, name: true },
    });

    // Create a map for easy lookup
    const folderMap = new Map(folders.map(f => [f.id, f]));

    const getFolderPath = (folderId: string): string => {
      const parts: string[] = [];
      const seen = new Set<string>();
      let folder = folderMap.get(folderId);
      while (folder && !seen.has(folder.id)) {
        seen.add(folder.id);
        parts.unshift(folder.name);
        folder = folder.parentId ? folderMap.get(folder.parentId) : undefined;
      }
      return path.join(...parts);
    };

    const selectedFolders = new Set<string>(folderIds.filter((id: string) => folderMap.has(id)));
    // Expand descendants once, then let PostgreSQL filter the selected records.
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const folder of folders) {
        if (folder.parentId && selectedFolders.has(folder.parentId) && !selectedFolders.has(folder.id)) {
          selectedFolders.add(folder.id);
          expanded = true;
        }
      }
    }
    const images = await prisma.resultFile.findMany({
      where: { projectId, OR: [{ id: { in: imageIds } }, { folderId: { in: [...selectedFolders] } }] },
      select: { id: true, folderId: true, filename: true, path: true },
    });
    const finalImagesToInclude = new Map(images.map(image => [image.id, image]));

    if (finalImagesToInclude.size === 0) {
        return NextResponse.json({ error: 'No images found in selection' }, { status: 404 });
    }

    // Build file list with relative paths preserving folder structure.
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

    return archiveResponse(files, `results_${projectId}.zip`);

  } catch (error) {
    console.error('Error creating ZIP:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
