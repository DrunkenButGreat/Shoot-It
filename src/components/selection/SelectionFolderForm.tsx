'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/I18nProvider';

type Folder = {
  id: string;
  name: string;
  parentId: string | null;
};

export function SelectionFolderForm({
  projectId,
  folder,
  isOpen,
  onClose,
  onSuccess,
}: {
  projectId: string;
  folder?: Folder;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(folder?.name || '');
  const [parentId, setParentId] = useState(folder?.parentId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset name when folder changes
  React.useEffect(() => {
    if (isOpen) {
      setName(folder?.name || '');
      setParentId(folder?.parentId || '');
    }
  }, [isOpen, folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const isEditing = !!folder;
      const url = isEditing 
        ? `/api/projects/${projectId}/selection/folders/${folder.id}`
        : `/api/projects/${projectId}/selection/folders`;
        
      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          parentId: parentId || null,
        }),
      });

      if (response.ok) {
        setName('');
        setParentId('');
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{folder ? t('selection.editFolder') : t('selection.newFolder')}</DialogTitle>
          <DialogDescription>
            {t('results.folderDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t('selection.folderName')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name}>
              {isSubmitting ? t('common.saving') : folder ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
