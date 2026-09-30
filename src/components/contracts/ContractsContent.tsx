'use client';

import { useState } from 'react';
import { ContractCard } from './ContractCard';
import { ContractForm } from './ContractForm';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/components/I18nProvider';

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
  const { t } = useI18n();

  const refreshContracts = async () => {
    const response = await fetch(`/api/projects/${projectId}/contracts`);
    if (response.ok) {
      const data = await response.json();
      setContracts(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-slate-950">
          {t('contracts.title')} ({contracts.length})
        </h2>
        <Button onClick={() => setIsFormOpen(true)} className="gap-2">
          {t('contracts.newContract')}
        </Button>
      </div>

      {contracts.length === 0 ? (
        <div className="studio-panel p-12 text-center">
          <p className="text-lg text-slate-600">{t('contracts.noContracts')}</p>
          <p className="mt-2 text-sm text-slate-400">{t('contracts.contractsPrompt')}</p>
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
