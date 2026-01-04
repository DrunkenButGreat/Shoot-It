'use client';

import { useState } from 'react';
import { ContractCard } from './ContractCard';
import { ContractForm } from './ContractForm';
import { Button } from '@/components/ui/button';

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

type Participant = {
  id: string;
  name: string;
};

export function ContractsContent({ 
  projectId, 
  initialContracts,
  participants 
}: { 
  projectId: string;
  initialContracts: Contract[];
  participants: Participant[];
}) {
  const [contracts, setContracts] = useState(initialContracts);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const refreshContracts = async () => {
    const response = await fetch(`/api/projects/${projectId}/contracts`);
    if (response.ok) {
      const data = await response.json();
      setContracts(data);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Button onClick={() => setIsFormOpen(true)}>
          New Contract
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {contracts.length === 0 ? (
          <p className="text-gray-500">No contracts yet. Create your first contract!</p>
        ) : (
          contracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              projectId={projectId}
              onDelete={refreshContracts}
            />
          ))
        )}
      </div>

      <ContractForm
        projectId={projectId}
        participants={participants}
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => {
          setIsFormOpen(false);
          refreshContracts();
        }}
      />
    </div>
  );
}
