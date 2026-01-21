'use client';

import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { ResultImageGrid } from '../results/ResultImageGrid';
import { FolderTree } from '../results/FolderTree';
import { Download, FolderOpen, Loader2, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

export function PublicResults({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [rootImages, setRootImages] = useState<ResultFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/results`);
      if (response.ok) {
        const data = await response.json();
        setFolders(data.folders || []);
        setRootImages(data.rootImages || []);
      }
    } catch (error) {
      console.error('Failed to fetch results:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, [projectId]);

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
          folderIds: [], // We only support image selection for now
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `results.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const hasSelection = selectedImageIds.size > 0;
  const currentFolder = folders.find(f => f.id === selectedFolderId);

  if (folders.length === 0 && rootImages.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 italic text-gray-400">
        {t('results.noFolders')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
         <div className="text-sm font-medium text-gray-500">
            {hasSelection ? t('results.itemsSelected').replace('{count}', selectedImageIds.size.toString()) : t('results.subtitle')}
         </div>
         {hasSelection && (
            <Button 
                variant="default" 
                size="sm" 
                disabled={isDownloading}
                onClick={handleDownload}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2"
            >
                <Download className="h-4 w-4" />
                {isDownloading ? t('common.loading') : t('results.downloadSelected')}
            </Button>
         )}
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
                  onDelete={() => {}} // Read-only
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={setSelectedFolderId}
                  isReadOnly={true}
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
                  onDelete={() => {}}
                  showDelete={false}
                  projectId={projectId}
                />
             </>
           )}
        </div>
      </div>
    </div>
  );
}
