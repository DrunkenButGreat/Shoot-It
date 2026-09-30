"use client"

import { useState } from "react"
import { Mail, Phone, Trash2, User } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/I18nProvider"

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
  const { t } = useI18n()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(t('participants.deleteConfirm').replace('{name}', participant.name))) {
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
        alert(t('participants.deleteError'))
      }
    } catch (error) {
      alert(t('auth.errorOccurred'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="group overflow-hidden bg-white transition-colors hover:border-slate-300">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            {participant.user?.image ? (
              <img
                src={participant.user.image}
                alt={participant.user.name || participant.name}
                className="h-14 w-14 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200">
                <User className="h-7 w-7 text-slate-500" />
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
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="line-clamp-3 text-sm leading-relaxed text-slate-600">
              {participant.notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card >
  )
}
