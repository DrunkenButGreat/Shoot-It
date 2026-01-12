"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoodboardGroup } from "./MoodboardGroup"
import { GroupForm } from "./GroupForm"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/I18nProvider"

interface MoodboardImage {
  id: string
  filename: string
  path: string
  thumbnail: string | null
  order: number
}

interface Comment {
  id: string
  content: string
  createdAt: Date
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
}

interface Group {
  id: string
  name: string
  description: string | null
  order: number
  status: string
  images: MoodboardImage[]
  comments: Comment[]
}

interface MoodboardContentProps {
  projectId: string
  initialGroups: Group[]
  galleryLayout?: string
  hasLocalMedia?: boolean
}

export function MoodboardContent({ projectId, initialGroups: groups, galleryLayout, hasLocalMedia }: MoodboardContentProps) {
  const router = useRouter()
  const { t } = useI18n();

  const handleGroupAdded = () => {
    router.refresh()
  }

  const handleGroupUpdated = () => {
    router.refresh()
  }

  const handleGroupDeleted = () => {
    router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('moodboard.title')} ({groups.length})
        </h2>
        <GroupForm projectId={projectId} onSuccess={handleGroupAdded} />
      </div>

      {groups.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">{t('moodboard.noGroups')}</p>
          <p className="text-sm text-gray-400 mt-2">{t('moodboard.groupsPrompt')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <MoodboardGroup
              key={group.id}
              group={group}
              projectId={projectId}
              galleryLayout={galleryLayout}
              hasLocalMedia={hasLocalMedia}
              onUpdate={handleGroupUpdated}
              onDelete={handleGroupDeleted}
            />
          ))}
        </div>
      )}
    </>
  )
}
