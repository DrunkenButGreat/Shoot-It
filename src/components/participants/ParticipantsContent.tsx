"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ParticipantCard } from "./ParticipantCard"
import { ParticipantForm } from "./ParticipantForm"
import { useI18n } from "@/components/I18nProvider"

interface Participant {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
  notes: string | null
  createdAt: Date
  images: any[]
  customFields: any[]
  user?: {
    id: string
    name: string | null
    image: string | null
  } | null
}

interface ParticipantsContentProps {
  projectId: string
  initialParticipants: Participant[]
}

export function ParticipantsContent({ projectId, initialParticipants: participants }: ParticipantsContentProps) {
  const router = useRouter()
  const { t } = useI18n();

  const handleParticipantAdded = () => {
    router.refresh()
  }

  const handleParticipantDeleted = () => {
    router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-slate-950">
          {t('participants.title')} ({participants.length})
        </h2>
        <ParticipantForm projectId={projectId} onSuccess={handleParticipantAdded} />
      </div>

      {participants.length === 0 ? (
        <div className="studio-panel p-12 text-center">
          <p className="text-lg text-slate-600">{t('participants.noParticipants')}</p>
          <p className="mt-2 text-sm text-slate-400">{t('participants.participantsPrompt')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {participants.map((participant) => (
            <ParticipantCard
              key={participant.id}
              participant={participant}
              projectId={projectId}
              onDelete={handleParticipantDeleted}
            />
          ))}
        </div>
      )}
    </>
  )
}
