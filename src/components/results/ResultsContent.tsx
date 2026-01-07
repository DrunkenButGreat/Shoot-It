'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FolderForm } from './FolderForm';
import { FolderTree } from './FolderTree';

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
      <div className="mb-6">
        <Button onClick={() => setIsFolderFormOpen(true)}>
          New Folder
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-6">
        {folders.length === 0 ? (
          <p className="text-gray-500">No folders yet. Create your first folder!</p>
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
