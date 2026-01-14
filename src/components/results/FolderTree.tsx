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
import { ResultImageGrid } from './ResultImageGrid';
import { CheckSquare, Square, ChevronDown, ChevronRight, Folder as FolderIcon, FolderOpen, Trash2 } from 'lucide-react';

type ResultFile = {
  id: string;
  filename: string;
  path: string;
  thumbnail: string | null;
  folderId: string | null;
};

type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  _count: {
    images: number;
  };
  images: ResultFile[];
};

export function FolderTree({
  folders,
  projectId,
  onDelete,
  selectedImageIds,
  setSelectedImageIds,
  selectedFolderIds,
  setSelectedFolderIds,
  isReadOnly = false,
}: {
  folders: Folder[];
  projectId: string;
  onDelete: () => void;
  selectedImageIds: Set<string>;
  setSelectedImageIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedFolderIds: Set<string>;
  setSelectedFolderIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  isReadOnly?: boolean;
}) {
  const { t } = useI18n();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(folders.filter(f => !f.parentId).map(f => f.id)));

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

  const handleImageDelete = async (imageId: string, folderId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/results/images/${imageId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onDelete();
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  const toggleFolderExpansion = (id: string) => {
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const toggleFolderSelection = (folder: Folder) => {
    const nextFolders = new Set(selectedFolderIds);
    const nextImages = new Set(selectedImageIds);

    const isSelecting = !nextFolders.has(folder.id);

    const setSelectionRecursive = (f: Folder, select: boolean) => {
      if (select) {
        nextFolders.add(f.id);
        f.images.forEach(img => nextImages.add(img.id));
      } else {
        nextFolders.delete(f.id);
        f.images.forEach(img => nextImages.delete(img.id));
      }

      const children = folders.filter(child => child.parentId === f.id);
      children.forEach(child => setSelectionRecursive(child, select));
    };

    setSelectionRecursive(folder, isSelecting);
    setSelectedFolderIds(nextFolders);
    setSelectedImageIds(nextImages);
  };

  const toggleImageSelection = (imageId: string) => {
    const next = new Set(selectedImageIds);
    if (next.has(imageId)) next.delete(imageId);
    else next.add(imageId);
    setSelectedImageIds(next);
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

    const renderFolder = (folder: Folder, level: number = 0) => {
      const isExpanded = expandedFolders.has(folder.id);
      const isSelected = selectedFolderIds.has(folder.id);
      const hasChildren = childMap.has(folder.id);
      const hasImages = folder.images && folder.images.length > 0;

      return (
        <div key={folder.id} className="py-1">
          <div className="flex items-center group">
             <div 
                className="flex items-center flex-1 p-2 rounded-xl transition-all border border-transparent hover:border-gray-200 hover:bg-white hover:shadow-sm"
                style={{ marginLeft: `${level * 24}px` }}
             >
                <div 
                    className="mr-2 cursor-pointer text-gray-400 hover:text-gray-600"
                    onClick={() => toggleFolderExpansion(folder.id)}
                >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>

                <div 
                    className={`mr-3 cursor-pointer transition-colors ${isSelected ? 'text-primary' : 'text-gray-300 group-hover:text-gray-400'}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleFolderSelection(folder);
                    }}
                    title={t('results.selectFolder')}
                >
                    {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                </div>

                <div className="flex items-center gap-3 flex-1 overflow-hidden" onClick={() => toggleFolderExpansion(folder.id)}>
                    <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                        {isExpanded ? <FolderOpen className="h-5 w-5 text-blue-500" /> : <FolderIcon className="h-5 w-5 text-gray-400" />}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="font-semibold text-gray-900 truncate">{folder.name}</span>
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                            {(folder._count?.images || 0)} {t('selection.images')}
                            {(folder.images?.length || 0) > 0 && ` • ${folder.images.length} geladen`}
                        </span>
                    </div>
                </div>

                {!isReadOnly && (
                    <div className="flex gap-2 items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            onClick={() => {
                                setSelectedFolder(folder);
                                setShowDeleteDialog(true);
                            }}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )}
             </div>
          </div>
          
          {isExpanded && (
            <div className="mt-2">
              <div style={{ marginLeft: `${(level + 1) * 24}px` }} className="pr-4 space-y-4">
                {hasImages && (
                  <ResultImageGrid
                    images={folder.images}
                    selectedIds={selectedImageIds}
                    onToggleSelect={toggleImageSelection}
                    onDelete={(imgId) => handleImageDelete(imgId, folder.id)}
                    showDelete={!isReadOnly}
                  />
                )}
                
                {/* Dedicated Upload Area for the folder */}
                {!isReadOnly && (
                  <ImageUpload
                    uploadUrl={`/api/projects/${projectId}/results/folders/${folder.id}/images`}
                    onSuccess={() => onDelete()}
                    className="w-full min-h-[160px] border-dashed bg-gray-50/50 hover:bg-gray-100/30 transition-all rounded-2xl flex flex-col items-center justify-center border-gray-200"
                  />
                )}
              </div>

              {hasChildren && (
                <div className="space-y-1 mt-1">
                  {childMap.get(folder.id)!.map(child => renderFolder(child, level + 1))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    };

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
