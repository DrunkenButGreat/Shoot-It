"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoodboardGroup } from "./MoodboardGroup"
import { GroupForm } from "./GroupForm"
import { MoodboardPicker } from "./MoodboardPicker"
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
  ownerId: string
  isArchived: boolean
  isLibrary: boolean
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

  const handleRefresh = () => {
    router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          {t('moodboard.title')} ({groups.length})
        </h2>
        <div className="flex gap-2">
          <MoodboardPicker projectId={projectId} onLink={handleRefresh} />
          <GroupForm projectId={projectId} onSuccess={handleRefresh} />
        </div>
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
              key={`${group.id}-${group.order}`}
              group={group}
              projectId={projectId}
              galleryLayout={galleryLayout}
              hasLocalMedia={hasLocalMedia}
              onUpdate={handleRefresh}
              onDelete={handleRefresh}
            />
          ))}
        </div>
      )}
    </>
  )
}
