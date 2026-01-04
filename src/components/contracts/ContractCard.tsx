'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Contract = {
  id: string;
  title: string;
  content: string;
  participantId: string | null;
  createdAt: Date;
  participant: {
    id: string;
    name: string;
  } | null;
  signatures: {
    id: string;
    signedAt: Date;
  }[];
};

export function ContractCard({
  contract,
  projectId,
  onDelete,
}: {
  contract: Contract;
  projectId: string;
  onDelete: () => void;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/contracts/${contract.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onDelete();
        setShowDeleteDialog(false);
      }
    } catch (error) {
      console.error('Failed to delete contract:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const isSigned = contract.signatures.length > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{contract.title}</CardTitle>
              <CardDescription>
                {contract.participant && `For: ${contract.participant.name}`}
                {' • '}
                Created: {new Date(contract.createdAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {isSigned && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded">
                  Signed
                </span>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap text-sm text-gray-700">
              {contract.content.substring(0, 200)}
              {contract.content.length > 200 && '...'}
            </p>
          </div>
          {isSigned && (
            <div className="mt-4 text-sm text-gray-600">
              Signed on: {new Date(contract.signatures[0].signedAt).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contract</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{contract.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
