"use client"

import { useState } from "react"
import { Mail, Phone, Trash2, User } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Participant {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string | null
  notes: string | null
  images: any[]
}

interface ParticipantCardProps {
  participant: Participant
  projectId: string
  onDelete?: () => void
}

export function ParticipantCard({ participant, projectId, onDelete }: ParticipantCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${participant.name}?`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/participants/${participant.id}`,
        { method: "DELETE" }
      )

      if (response.ok) {
        onDelete?.()
      } else {
        alert("Failed to delete participant")
      }
    } catch (error) {
      alert("An error occurred")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{participant.name}</CardTitle>
              {participant.role && (
                <CardDescription>{participant.role}</CardDescription>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {participant.email && (
            <div className="flex items-center gap-2 text-gray-600">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${participant.email}`} className="hover:underline">
                {participant.email}
              </a>
            </div>
          )}
          {participant.phone && (
            <div className="flex items-center gap-2 text-gray-600">
              <Phone className="h-4 w-4" />
              <a href={`tel:${participant.phone}`} className="hover:underline">
                {participant.phone}
              </a>
            </div>
          )}
          {participant.notes && (
            <p className="text-gray-600 text-sm mt-3 line-clamp-2">
              {participant.notes}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
