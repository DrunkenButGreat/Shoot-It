'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FolderForm } from './FolderForm';
import { FolderTree } from './FolderTree';
import { FolderPlus, FolderOpen, Download, CheckSquare, Square, Upload } from 'lucide-react';
import { useI18n } from '@/components/I18nProvider';
import { ResultImageGrid } from './ResultImageGrid';
import ImageUpload from '../moodboard/ImageUpload';

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
  parent: {
    id: string;
    name: string;
  } | null;
  _count: {
    images: number;
  };
  images: ResultFile[];
};

export function ResultsContent({
  projectId,
  initialFolders: folders,
  rootImages = []
}: {
  projectId: string;
  initialFolders: Folder[];
  rootImages?: ResultFile[];
}) {
  const [isFolderFormOpen, setIsFolderFormOpen] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  
  const router = useRouter();
  const { t } = useI18n();

  const refreshFolders = () => {
    router.refresh();
  };

  const handleDownload = async () => {
    if (selectedImageIds.size === 0 && selectedFolderIds.size === 0) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/results/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageIds: Array.from(selectedImageIds),
          folderIds: Array.from(selectedFolderIds),
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `results_${projectId}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Download failed');
      }
    } catch (error) {
      console.error('Failed to download:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedImageIds.size > 0 || selectedFolderIds.size > 0) {
      setSelectedImageIds(new Set());
      setSelectedFolderIds(new Set());
    } else {
      const allImageIds = new Set<string>();
      const allFolderIds = new Set<string>();
      
      const addFromFolders = (fList: Folder[]) => {
        fList.forEach(f => {
          allFolderIds.add(f.id);
          f.images.forEach(img => allImageIds.add(img.id));
        });
      };
      
      addFromFolders(folders as Folder[]);
      rootImages.forEach(img => allImageIds.add(img.id));
      setSelectedImageIds(allImageIds);
      setSelectedFolderIds(allFolderIds);
    }
  };

  const toggleImageSelection = (imageId: string) => {
    const next = new Set(selectedImageIds);
    if (next.has(imageId)) next.delete(imageId);
    else next.add(imageId);
    setSelectedImageIds(next);
  };

  const handleImageDelete = async (imageId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/results/images/${imageId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        refreshFolders();
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  const hasSelection = selectedImageIds.size > 0 || selectedFolderIds.size > 0;
  const totalFilesSelected = selectedImageIds.size;

  return (
    <div>
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {t('results.title')}
          </h2>
          <p className="text-sm text-gray-500 mt-1 italic">{t('results.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {folders.length > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleSelectAll}
                className="gap-2"
              >
                {hasSelection ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {hasSelection ? t('results.deselectAll') : t('results.selectAll')}
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                disabled={!hasSelection || isDownloading}
                onClick={handleDownload}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                {isDownloading ? t('common.saving') : t('results.downloadSelected')}
                {totalFilesSelected > 0 && ` (${totalFilesSelected})`}
              </Button>
            </>
          )}
          <Button onClick={() => setIsFolderFormOpen(true)} className="gap-2" size="sm">
            <FolderPlus className="h-4 w-4" />
            {t('results.newFolder')}
          </Button>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-none shadow-md p-8 min-h-[400px]">
        {/* Root Images Section */}
        {(rootImages.length > 0) && (
          <div className="mb-10 border-b border-gray-100 pb-10">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              {t('results.rootLevel')}
            </h3>
            <ResultImageGrid
              images={rootImages}
              selectedIds={selectedImageIds}
              onToggleSelect={toggleImageSelection}
              onDelete={handleImageDelete}
            />
          </div>
        )}

        {/* Global/Root Upload */}
        <div className="mb-10">
          <ImageUpload
            uploadUrl={`/api/projects/${projectId}/results/images`}
            onSuccess={() => refreshFolders()}
            className="w-full min-h-[160px] border-dashed bg-gray-50/50 hover:bg-gray-100/30 transition-all rounded-2xl flex flex-col items-center justify-center border-gray-200"
          />
        </div>

        {folders.length === 0 && rootImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <FolderOpen className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-gray-500 text-lg font-medium">{t('results.noFolders')}</p>
            <p className="text-sm text-gray-400 mt-2 max-w-[300px]">{t('results.foldersPrompt')}</p>
            <Button onClick={() => setIsFolderFormOpen(true)} variant="outline" className="mt-6 border-blue-100 text-blue-600 hover:bg-blue-50 rounded-xl">
              {t('results.createFirst')}
            </Button>
          </div>
        ) : folders.length > 0 ? (
          <FolderTree
            folders={folders}
            projectId={projectId}
            onDelete={refreshFolders}
            selectedImageIds={selectedImageIds}
            setSelectedImageIds={setSelectedImageIds}
            selectedFolderIds={selectedFolderIds}
            setSelectedFolderIds={setSelectedFolderIds}
          />
        ) : null}
      </div>

      <FolderForm
        projectId={projectId}
        folders={folders}
        isOpen={isFolderFormOpen}
        onClose={() => setIsFolderFormOpen(false)}
        onSuccess={() => {
          setIsFolderFormOpen(false);
          refreshFolders();
        }}
      />
    </div>
  );
}
