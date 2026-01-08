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
  user?: {
    id: string
    name: string | null
    image: string | null
  } | null
}

interface ParticipantCardProps {
  participant: Participant
  projectId: string
  onDelete?: () => void
}

export function ParticipantCard({ participant, projectId, onDelete }: ParticipantCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Möchtest du ${participant.name} wirklich entfernen?`)) {
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
        alert("Fehler beim Löschen")
      }
    } catch (error) {
      alert("Ein Fehler ist aufgetreten")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="overflow-hidden border-none shadow-md hover:shadow-xl transition-all bg-white/90 backdrop-blur-sm group">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            {participant.user?.image ? (
              <img
                src={participant.user.image}
                alt={participant.user.name || participant.name}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-50/50 shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <User className="h-7 w-7 text-white" />
              </div>
            )}
            <div>
              <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {participant.name}
              </CardTitle>
              {participant.role && (
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                  {participant.role}
                </div>
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
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-3 pt-2 border-t border-gray-50">
          {participant.email && (
            <a
              href={`mailto:${participant.email}`}
              className="flex items-center gap-3 text-gray-600 hover:text-blue-600 transition-colors py-1.5 px-2 rounded-md hover:bg-blue-50/50"
            >
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                <Mail className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium truncate">{participant.email}</span>
            </a>
          )}
          {participant.phone && (
            <a
              href={`tel:${participant.phone}`}
              className="flex items-center gap-3 text-gray-600 hover:text-blue-600 transition-colors py-1.5 px-2 rounded-md hover:bg-blue-50/50"
            >
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                <Phone className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">{participant.phone}</span>
            </a>
          )}
        </div>

        {participant.notes && (
          <div className="mt-4 p-3 rounded-xl bg-gray-50/80 border border-gray-100/50">
            <p className="text-gray-600 text-sm italic leading-relaxed line-clamp-3">
              "{participant.notes}"
            </p>
          </div>
        )}
      </CardContent>
    </Card >
  )
}
