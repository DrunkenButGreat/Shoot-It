"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { ChevronRight, FileText } from "lucide-react";
import { useState } from "react";
import { ContractCard } from "./ContractCard";
import { ContractForm } from "./ContractForm";

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
}: {
  projectId: string;
  initialContracts: Contract[];
  participants: Participant[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contracts, setContracts] = useState(initialContracts);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { t } = useI18n();
  const selectedContract =
    contracts.find((contract) => contract.id === selectedId) || contracts[0];

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
        <h2 className="studio-page-title">
          {t("contracts.title")} ({contracts.length})
        </h2>
        <Button onClick={() => setIsFormOpen(true)} className="gap-2">
          {t("contracts.newContract")}
        </Button>
      </div>

      {contracts.length === 0 ? (
        <div className="studio-panel p-12 text-center">
          <p className="text-lg text-slate-600">{t("contracts.noContracts")}</p>
          <p className="mt-2 text-sm text-slate-400">
            {t("contracts.contractsPrompt")}
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-2">
            {contracts.map((contract) => (
              <button
                key={contract.id}
                onClick={() => setSelectedId(contract.id)}
                aria-pressed={selectedContract?.id === contract.id}
                className={`flex w-full items-center gap-3 rounded-lg border bg-white p-4 text-left ${selectedContract?.id === contract.id ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}
              >
                <FileText className="h-5 w-5 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {contract.title}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {contract.signatures.length} {t("design.signatures")}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
          {selectedContract && (
            <ContractCard
              contract={selectedContract}
              projectId={projectId}
              onDelete={refreshContracts}
            />
          )}
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
