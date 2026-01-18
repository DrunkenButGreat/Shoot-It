'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FolderForm } from './FolderForm';
import { FolderTree } from './FolderTree';
import { FolderPlus, Download, CheckSquare, Square, FolderOpen } from 'lucide-react';
import { useI18n } from '@/components/I18nProvider';
import { ResultImageGrid } from './ResultImageGrid';
import ImageUpload from '../moodboard/ImageUpload';
import { appConfig } from '@/config/app.config';
import { Checkbox } from '@/components/ui/checkbox';

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
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); // null = All, 'unassigned' = Root
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  
  const router = useRouter();
  const { t } = useI18n();

  const refreshFolders = () => {
    router.refresh();
  };

  // derived state for filtered images
  const filteredImages = useMemo(() => {
    if (selectedFolderId === null) {
      // All images
      const allImages = [...rootImages];
      folders.forEach(f => allImages.push(...f.images));
      return allImages;
    }
    if (selectedFolderId === 'unassigned') {
      return rootImages;
    }
    const folder = folders.find(f => f.id === selectedFolderId);
    return folder ? folder.images : [];
  }, [selectedFolderId, folders, rootImages]);

  const handleDownload = async () => {
    if (selectedImageIds.size === 0) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/results/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageIds: Array.from(selectedImageIds),
          folderIds: [], // We only support image selection for now to match UI
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
    if (selectedImageIds.size === filteredImages.length) {
      setSelectedImageIds(new Set());
    } else {
      const allImageIds = new Set<string>(filteredImages.map(img => img.id));
      setSelectedImageIds(allImageIds);
    }
  };

  const toggleImageSelection = (imageId: string) => {
    const next = new Set(selectedImageIds);
    if (next.has(imageId)) next.delete(imageId);
    else next.add(imageId);
    setSelectedImageIds(next);
  };

  const handleImageDelete = async (imageId: string) => {
    if (!confirm(t('common.deleteConfirm'))) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/results/images/${imageId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        refreshFolders();
        setSelectedImageIds(prev => {
          const next = new Set(prev);
          next.delete(imageId);
          return next;
        });
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  const currentFolder = folders.find(f => f.id === selectedFolderId);
  const uploadUrl = selectedFolderId && selectedFolderId !== 'unassigned' 
    ? `/api/projects/${projectId}/results/folders/${selectedFolderId}/images` 
    : `/api/projects/${projectId}/results/images`;

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {t('results.title')}
          </h2>
          <p className="text-sm text-gray-500 mt-1 italic">{t('results.subtitle')}</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => setIsFolderFormOpen(true)} className="gap-2" size="sm" variant="outline">
            <FolderPlus className="h-4 w-4" />
            {t('results.newFolder')}
          </Button>

          {selectedImageIds.size > 0 && (
            <Button 
                variant="default" 
                size="sm" 
                disabled={isDownloading}
                onClick={handleDownload}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                {isDownloading ? t('common.saving') : t('results.downloadSelected')}
                {selectedImageIds.size > 0 && ` (${selectedImageIds.size})`}
              </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8 min-h-[600px]">
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-24">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">{t('selection.folders')}</h3>
              </div>
              <div className="p-2 space-y-1">
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    selectedFolderId === null 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-4 h-4" />
                  {t('selection.allImages')}
                </button>

                <button
                  onClick={() => setSelectedFolderId('unassigned')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    selectedFolderId === 'unassigned'
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-4 h-4" />
                  {t('selection.unassigned')}
                </button>
                
                <FolderTree
                  folders={folders}
                  projectId={projectId}
                  onDelete={refreshFolders}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={setSelectedFolderId}
                />
              </div>
            </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 space-y-8 bg-white/50 rounded-2xl p-6 border border-gray-100">
           {selectedFolderId && selectedFolderId !== 'unassigned' && (
              <div className="flex items-center gap-2 text-sm text-gray-500 pb-2 border-b border-gray-100">
                  <FolderOpen className="h-4 w-4" />
                  <span>{currentFolder?.name}</span>
              </div>
           )}

           {filteredImages.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                  <FolderOpen className="h-8 w-8 text-slate-300" />
                </div>
                <p className="text-gray-500 text-lg font-medium">{t('common.noImages')}</p>
                <p className="text-sm text-gray-400 mt-2 max-w-[300px]">{t('common.uploadPrompt')}</p>
             </div>
           ) : (
             <>
               <div className="flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={toggleSelectAll}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {selectedImageIds.size === filteredImages.length ? (
                    <CheckSquare className="h-4 w-4 mr-2" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  {selectedImageIds.size === filteredImages.length ? t('results.deselectAll') : t('results.selectAll')}
                </Button>
                <p className="text-sm text-gray-500">
                  {filteredImages.length} {t('selection.images')}
                </p>
               </div>

               <ResultImageGrid
                  images={filteredImages}
                  selectedIds={selectedImageIds}
                  onToggleSelect={toggleImageSelection}
                  onDelete={handleImageDelete}
                  projectId={projectId}
                />
             </>
           )}

           {/* Upload Area */}
           <div className="pt-8 border-t border-gray-100">
             <h4 className="text-sm font-semibold text-gray-900 mb-4">{t('results.uploadToCurrent')}</h4>
             <ImageUpload
                uploadUrl={uploadUrl}
                onSuccess={() => refreshFolders()}
                maxSize={appConfig.limits.maxResultsUploadSize}
                enableFolderUpload
                className="w-full min-h-[160px] border-dashed bg-gray-50/50 hover:bg-gray-100/30 transition-all rounded-2xl flex flex-col items-center justify-center border-gray-200"
              />
           </div>
        </div>
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
