'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  _count: {
    images: number;
  };
};

export function FolderTree({
  folders,
  projectId,
  onDelete,
}: {
  folders: Folder[];
  projectId: string;
  onDelete: () => void;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!selectedFolder) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/results/folders/${selectedFolder.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onDelete();
        setShowDeleteDialog(false);
        setSelectedFolder(null);
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const buildTree = () => {
    const rootFolders = folders.filter(f => !f.parentId);
    const childMap = new Map<string, Folder[]>();
    
    folders.forEach(folder => {
      if (folder.parentId) {
        if (!childMap.has(folder.parentId)) {
          childMap.set(folder.parentId, []);
        }
        childMap.get(folder.parentId)!.push(folder);
      }
    });

    const renderFolder = (folder: Folder, level: number = 0) => (
      <div key={folder.id} style={{ marginLeft: `${level * 24}px` }} className="py-2">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">📁</span>
            <span className="font-medium">{folder.name}</span>
            <span className="text-sm text-gray-500">({folder._count.images} images)</span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setSelectedFolder(folder);
              setShowDeleteDialog(true);
            }}
          >
            Delete
          </Button>
        </div>
        {childMap.has(folder.id) && (
          <div className="mt-1">
            {childMap.get(folder.id)!.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );

    return rootFolders.map(folder => renderFolder(folder));
  };

  return (
    <>
      <div className="space-y-1">
        {buildTree()}
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedFolder?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
