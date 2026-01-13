"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoodboardGroup } from "./MoodboardGroup"
import { GroupForm } from "./GroupForm"
import { useI18n } from "@/components/I18nProvider"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface Group {
  id: string
  name: string
  description: string | null
  ownerId: string
  isArchived: boolean
  images: any[]
  _count?: {
    projectLinks: number
  }
}

interface MoodboardCollectionProps {
  initialGroups: Group[]
}

export function MoodboardCollection({ initialGroups }: MoodboardCollectionProps) {
  const router = useRouter()
  const { t } = useI18n()
  const [search, setSearch] = useState("")
  const [currentTab, setCurrentTab] = useState<'active' | 'archived'>('active')

  const filteredGroups = initialGroups.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase())
    const matchesTab = currentTab === 'active' ? !g.isArchived : g.isArchived
    return matchesSearch && matchesTab
  })

  const handleUpdated = () => {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('common.search') || "Suchen..."}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-4">
            <button
              onClick={() => setCurrentTab('active')}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${currentTab === 'active'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              {t('common.active')}
            </button>
            <button
              onClick={() => setCurrentTab('archived')}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${currentTab === 'archived'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              {t('common.archived')}
            </button>
          </div>
          <GroupForm onSuccess={() => router.refresh()} />
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">
            {search ? t('common.noResults') : (currentTab === 'active' ? t('moodboard.noGroups') : t('common.noArchived'))}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredGroups.map((group) => (
            <MoodboardGroup
              key={group.id}
              group={group as any}
              projectId="" // Empty project id means we are in collection view
              onUpdate={handleUpdated}
              onDelete={handleUpdated}
            />
          ))}
        </div>
      )}
    </div>
  )
}
