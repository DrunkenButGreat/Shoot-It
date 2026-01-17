"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { MoodboardGroup } from "./MoodboardGroup"
import { GroupForm } from "./GroupForm"
import { useI18n } from "@/components/I18nProvider"
import { Input } from "@/components/ui/input"
import { Search, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MoodboardImage {
  id: string
  filename: string
  path: string
  thumbnail: string | null
  order: number
}

interface Group {
  id: string
  name: string
  description: string | null
  ownerId: string
  isArchived: boolean
  isFavorite: boolean
  isLibrary: boolean
  createdAt: Date
  images: MoodboardImage[]
  _count?: {
    projectLinks: number
  }
}

interface MoodboardCollectionProps {
  initialGroups: Group[]
  showFavorites?: boolean
}

export function MoodboardCollection({ initialGroups, showFavorites = true }: MoodboardCollectionProps) {
  const router = useRouter()
  const { t } = useI18n()
  const [search, setSearch] = useState("")
  const [currentTab, setCurrentTab] = useState<'active' | 'archived'>('active')
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "alphabetical" | "favorites">("favorites")
  const [allCollapsed, setAllCollapsed] = useState(false)

  const filteredAndSortedGroups = useMemo(() => {
    // 1. Filter by Tab and Search
    let result = initialGroups.filter(g => {
      const matchesSearch = !search || 
        g.name.toLowerCase().includes(search.toLowerCase()) || 
        g.description?.toLowerCase().includes(search.toLowerCase())
      const matchesTab = currentTab === 'active' ? !g.isArchived : g.isArchived
      return matchesSearch && matchesTab
    })

    // 2. Sort
    result.sort((a, b) => {
      if (sortBy === "favorites") {
        if (a.isFavorite && !b.isFavorite) return -1
        if (!a.isFavorite && b.isFavorite) return 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (sortBy === "alphabetical") return a.name.localeCompare(b.name)
      return 0
    })

    return result
  }, [initialGroups, search, currentTab, sortBy])

  const handleUpdated = () => {
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex bg-gray-100 p-1 rounded-lg self-start">
            <button
              onClick={() => setCurrentTab('active')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${currentTab === 'active'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {t('common.active')}
            </button>
            <button
              onClick={() => setCurrentTab('archived')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${currentTab === 'archived'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {t('common.archived')}
            </button>
          </div>
          <GroupForm onSuccess={() => router.refresh()} />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t('moodboard.searchPlaceholder')}
              className="pl-9 w-full bg-white transition-all focus:ring-2 focus:ring-blue-500/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative inline-block w-full sm:w-48">
              <select
                className="w-full h-9 pl-3 pr-8 bg-white border border-gray-200 rounded-md text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="favorites">{t('common.sortFavorites')}</option>
                <option value="newest">{t('common.sortNewest')}</option>
                <option value="oldest">{t('common.sortOldest')}</option>
                <option value="alphabetical">{t('common.sortAlphabetical')}</option>
              </select>
              <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 sm:flex-none gap-2 whitespace-nowrap"
              onClick={() => setAllCollapsed(!allCollapsed)}
            >
              {allCollapsed ? (
                <><ChevronDown className="h-4 w-4" /> {t('moodboard.expandAll')}</>
              ) : (
                <><ChevronUp className="h-4 w-4" /> {t('moodboard.collapseAll')}</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {filteredAndSortedGroups.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">
            {search ? t('common.noResults') : (currentTab === 'active' ? t('moodboard.noGroups') : t('common.noArchived'))}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredAndSortedGroups.map((group) => (
            <MoodboardGroup
              key={group.id}
              group={group as any}
              projectId="" // Empty project id means we are in collection view
              onUpdate={handleUpdated}
              onDelete={handleUpdated}
              showFavorites={showFavorites}
              isInitiallyCollapsed={allCollapsed}
            />
          ))}
        </div>
      )}
    </div>
  )
}
