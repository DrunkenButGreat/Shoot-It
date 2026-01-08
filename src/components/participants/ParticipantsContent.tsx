"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ParticipantCard } from "./ParticipantCard"
import { ParticipantForm } from "./ParticipantForm"

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

  const handleParticipantAdded = () => {
    router.refresh()
  }

  const handleParticipantDeleted = () => {
    router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Participants ({participants.length})
        </h2>
        <ParticipantForm projectId={projectId} onSuccess={handleParticipantAdded} />
      </div>

      {participants.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">No participants yet</p>
          <p className="text-sm text-gray-400 mt-2">Add participants to start organizing your photoshoot</p>
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
