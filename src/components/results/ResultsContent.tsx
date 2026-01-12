'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FolderForm } from './FolderForm';
import { FolderTree } from './FolderTree';
import { FolderPlus, FolderOpen } from 'lucide-react';

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
};

export function ResultsContent({
  projectId,
  initialFolders: folders
}: {
  projectId: string;
  initialFolders: Folder[];
}) {
  const [isFolderFormOpen, setIsFolderFormOpen] = useState(false);
  const router = useRouter();

  const refreshFolders = () => {
    router.refresh();
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Results
          </h2>
          <p className="text-sm text-gray-500 mt-1 italic">Organize and share your final deliverable folders</p>
        </div>
        <Button onClick={() => setIsFolderFormOpen(true)} className="gap-2">
          <FolderPlus className="h-4 w-4" />
          New Folder
        </Button>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-2xl border-none shadow-md p-8 min-h-[400px]">
        {folders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
              <FolderOpen className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-gray-500 text-lg font-medium">No result folders yet</p>
            <p className="text-sm text-gray-400 mt-2 max-w-[300px]">Create folders to organize high-res exports and deliverables for your client</p>
            <Button onClick={() => setIsFolderFormOpen(true)} variant="outline" className="mt-6 border-blue-100 text-blue-600 hover:bg-blue-50 rounded-xl">
              Create First Folder
            </Button>
          </div>
        ) : (
          <FolderTree
            folders={folders}
            projectId={projectId}
            onDelete={refreshFolders}
          />
        )}
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
