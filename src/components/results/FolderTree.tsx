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
import { useI18n } from '@/components/I18nProvider';
import { ChevronDown, ChevronRight, Folder as FolderIcon, FolderOpen, Trash2, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  selectedFolderId,
  onSelectFolder,
  isReadOnly = false,
}: {
  folders: Folder[];
  projectId: string;
  onDelete: () => void;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  isReadOnly?: boolean;
}) {
  const { t } = useI18n();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Initialize with root folders expanded or empty. 
  // SelectionFolderTree uses empty by default, but let's keep some expanded if needed.
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const handleDelete = async () => {
    if (!folderToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/results/folders/${folderToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onDelete();
        setShowDeleteDialog(false);
        setFolderToDelete(null);
        if (selectedFolderId === folderToDelete.id) {
          onSelectFolder(null);
        }
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleFolderExpansion = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const buildTree = () => {
    const rootFolders = folders.filter(f => !f.parentId);
    // Sort logic could go here if needed
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
      const isSelected = selectedFolderId === folder.id;
      const children = childMap.get(folder.id) || [];
      const hasChildren = children.length > 0;

      return (
        <div key={folder.id} className="space-y-0.5">
          <div
             className={`flex items-center justify-between group py-1.5 px-2 rounded-lg transition-all border-2 cursor-pointer ${
                isSelected ? 'bg-blue-50 text-blue-700 font-medium border-transparent' : 'border-transparent text-gray-600 hover:bg-gray-50'
             }`}
             style={{ marginLeft: `${level * 12}px` }}
             onClick={() => onSelectFolder(folder.id)}
          >
             <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <button 
                  onClick={(e) => toggleFolderExpansion(folder.id, e)}
                  className={`p-0.5 hover:bg-white rounded transition-colors ${!hasChildren ? 'invisible' : ''}`}
                >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <div className="flex items-center gap-2 truncate">
                    {isExpanded ? (
                        <FolderOpen className={`h-4 w-4 shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
                    ) : (
                        <FolderIcon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-blue-500' : 'text-gray-400'}`} />
                    )}
                    <span className="text-sm truncate">{folder.name}</span>
                </div>
             </div>

             {!isReadOnly && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreVertical className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                                className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFolderToDelete(folder);
                                    setShowDeleteDialog(true);
                                }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                {t('common.delete')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
             )}
          </div>
          
          {isExpanded && hasChildren && (
            <div className="mt-0.5">
               {children.map(child => renderFolder(child, level + 1))}
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
              {t('results.deleteConfirm')} ("{folderToDelete?.name}")
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
