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
import ImageUpload from '../moodboard/ImageUpload';
import { useI18n } from '@/components/I18nProvider';

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
  const { t } = useI18n();
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
            <span className="text-sm text-gray-500">({folder._count.images} {t('selection.images')})</span>
          </div>
          <div className="flex gap-2">
            <ImageUpload
              uploadUrl={`/api/projects/${projectId}/results/folders/${folder.id}/images`}
              onSuccess={() => onDelete()}
              label={t('results.upload')}
              compact
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setSelectedFolder(folder);
                setShowDeleteDialog(true);
              }}
            >
              {t('common.delete')}
            </Button>
          </div>
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
            <DialogTitle>{t('results.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('results.deleteConfirm')} ("{selectedFolder?.name}")
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? t('common.loading') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
