'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Folder as FolderIcon, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  MoreVertical,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/components/I18nProvider";
import { SelectionImageGrid } from "./SelectionImageGrid";
import ImageUpload from "../moodboard/ImageUpload";

interface Rating {
  id: string;
  stars: number | null;
  color: string | null;
}

interface SelectionImage {
  id: string;
  filename: string;
  path: string;
  thumbnail: string | null;
  width?: number | null;
  height?: number | null;
  ratings: Rating | null;
  folderId?: string | null;
}

interface SelectionFolder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  images: SelectionImage[];
  children?: SelectionFolder[];
  _count?: {
    images: number;
    children: number;
  };
}

interface SelectionFolderTreeProps {
  folders: SelectionFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onDeleteFolder: (id: string) => void;
  onEditFolder: (folder: SelectionFolder) => void;
  onMoveImages: (imageIds: string[], targetFolderId: string | null) => Promise<void>;
}

export function SelectionFolderTree({
  folders,
  selectedFolderId,
  onSelectFolder,
  onDeleteFolder,
  onEditFolder,
  onMoveImages
}: SelectionFolderTreeProps) {
  const { t } = useI18n();
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const toggleFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expandedFolders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedFolders(next);
  };

  const onDragOver = (e: React.DragEvent, id: string | null) => {
    e.preventDefault();
    setDragOverFolder(id);
  };

  const onDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverFolder(null);
    const data = e.dataTransfer.getData("application/json");
    if (data) {
      try {
        const { imageId, selectedIds } = JSON.parse(data);
        const idsToMove = selectedIds?.length > 0 ? selectedIds : [imageId];
        if (idsToMove.length > 0) {
          await onMoveImages(idsToMove, folderId);
        }
      } catch (err) {
        console.error("Drop failed", err);
      }
    }
  };

  const renderFolder = (folder: SelectionFolder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolderId === folder.id;
    const childFolders = folders.filter(f => f.parentId === folder.id);
    const isOver = dragOverFolder === folder.id;

    return (
      <div key={folder.id} className="space-y-0.5">
        <div 
          className={`flex items-center justify-between group py-1.5 px-2 rounded-lg transition-all border-2 cursor-pointer ${
            isOver ? 'border-blue-500 bg-blue-50' : 'border-transparent'
          } ${
            isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
          }`}
          style={{ marginLeft: `${level * 1}rem` }}
          onDragOver={(e) => onDragOver(e, folder.id)}
          onDragLeave={() => setDragOverFolder(null)}
          onDrop={(e) => onDrop(e, folder.id)}
          onClick={() => onSelectFolder(folder.id)}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <button 
              onClick={(e) => toggleFolder(folder.id, e)}
              className="p-0.5 hover:bg-white rounded transition-colors"
            >
              {childFolders.length > 0 ? (
                isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <div className="w-3.5 h-3.5" />
              )}
            </button>
            <div className="flex items-center gap-2 truncate">
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-500 shrink-0" />
              ) : (
                <FolderIcon className="h-4 w-4 text-gray-400 shrink-0" />
              )}
              <span className="text-sm truncate">{folder.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditFolder(folder)}>
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-red-600 focus:text-red-600"
                  onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isExpanded && childFolders.map(child => renderFolder(child, level + 1))}
      </div>
    );
  };

  const topLevelFolders = folders.filter(f => !f.parentId);

  return (
    <div className="space-y-0.5">
      {topLevelFolders.map(folder => renderFolder(folder))}
    </div>
  );
}
