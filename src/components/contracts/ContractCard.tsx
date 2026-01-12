'use client';

import { useState } from 'react';
import { Trash2, FileText, CheckCircle } from 'lucide-react';
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
  createdAt: Date;
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
      <Card className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all bg-white/90 backdrop-blur-sm group">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-sm">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {contract.title}
                </CardTitle>
                <CardDescription className="flex items-center gap-1.5 mt-1">
                  Created: {new Date(contract.createdAt).toLocaleDateString()}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSigned && (
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Signed
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
                className="hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="prose max-w-none pt-2 border-t border-gray-50">
            <p className="whitespace-pre-wrap text-sm text-gray-600 leading-relaxed italic">
              "{contract.content.substring(0, 140)}
              {contract.content.length > 140 && '...'}"
            </p>
          </div>
          {isSigned && (
            <div className="mt-2 text-[11px] font-medium text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
              Last signed: {new Date(contract.signatures[0].signedAt).toLocaleString()}
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
