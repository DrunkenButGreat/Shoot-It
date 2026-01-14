'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { ResultImageGrid } from '../results/ResultImageGrid';
import { FolderTree } from '../results/FolderTree';
import { Download, FolderOpen, Loader2 } from 'lucide-react';
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
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
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
      
      addFromFolders(folders);
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const hasSelection = selectedImageIds.size > 0 || selectedFolderIds.size > 0;
  const totalFilesSelected = selectedImageIds.size;

  if (folders.length === 0 && rootImages.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 italic text-gray-400">
        {t('results.noFolders')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-gray-100">
        <div className="text-sm font-medium text-gray-500">
          {totalFilesSelected > 0 ? t('results.itemsSelected').replace('{count}', totalFilesSelected.toString()) : t('results.subtitle')}
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleSelectAll}
            className="rounded-xl"
          >
            {hasSelection ? t('results.deselectAll') : t('results.selectAll')}
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            disabled={!hasSelection || isDownloading}
            onClick={handleDownload}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? t('common.loading') : t('results.downloadSelected')}
          </Button>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-sm p-6">
        {rootImages.length > 0 && (
          <div className="mb-8 pb-8 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
              {t('results.rootLevel')}
            </h3>
            <ResultImageGrid
              images={rootImages}
              selectedIds={selectedImageIds}
              onToggleSelect={toggleImageSelection}
              onDelete={() => {}} // Read-only
              showDelete={false}
            />
          </div>
        )}

        <FolderTree
          folders={folders}
          projectId={projectId}
          onDelete={() => {}} // Read-only
          selectedImageIds={selectedImageIds}
          setSelectedImageIds={setSelectedImageIds}
          selectedFolderIds={selectedFolderIds}
          setSelectedFolderIds={setSelectedFolderIds}
          isReadOnly={true}
        />
      </div>
    </div>
  );
}
