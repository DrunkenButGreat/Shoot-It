'use client';

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

type Participant = {
  id: string;
  name: string;
};

export function ContractForm({
  projectId,
  participants,
  isOpen,
  onClose,
  onSuccess,
}: {
  projectId: string;
  participants: Participant[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          participantId: participantId || null,
        }),
      });

      if (response.ok) {
        setTitle('');
        setContent('');
        setParticipantId('');
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to create contract:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Contract</DialogTitle>
          <DialogDescription>
            Create a new contract for this project. You can write the contract content in markdown format.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Contract Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Model Release Form"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="participant">Participant (Optional)</Label>
              <select
                id="participant"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">-- Select Participant --</option>
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Contract Content (Markdown)</Label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter contract terms and conditions..."
                className="w-full min-h-[200px] px-3 py-2 border rounded-md"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Contract'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
