'use client';

import { useState } from 'react';
import { ContractCard } from './ContractCard';
import { ContractForm } from './ContractForm';
import { Button } from '@/components/ui/button';

type Contract = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  participantId?: never; // Schema update: Contracts are project-level, not per participant
  participant?: never;
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
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Contracts ({contracts.length})
        </h2>
        <Button onClick={() => setIsFormOpen(true)} className="gap-2">
          New Contract
        </Button>
      </div>

      {contracts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">No contracts yet</p>
          <p className="text-sm text-gray-400 mt-2">Create contracts for your participants to sign</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              projectId={projectId}
              onDelete={refreshContracts}
            />
          ))}
        </div>
      )}

      <ContractForm
        projectId={projectId}
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
