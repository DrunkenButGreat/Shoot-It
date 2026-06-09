"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useI18n } from "@/components/I18nProvider"
import { gridThumbUrl } from "@/lib/image-urls"
import { Search, Plus, Check } from "lucide-react"
import { Input } from "@/components/ui/input"

interface Group {
  id: string
  name: string
  description: string | null
  images: { path: string }[]
}

interface MoodboardPickerProps {
  projectId: string
  onLink: () => void
}

export function MoodboardPicker({ projectId, onLink }: MoodboardPickerProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      fetchGroups()
    }
  }, [open])

  const fetchGroups = async () => {
    try {
      const response = await fetch("/api/user/moodboards")
      if (response.ok) {
        const data = await response.json()
        setGroups(data)
      }
    } catch (error) {
      console.error("Error fetching moodboards:", error)
    }
  }

  const handleLink = async () => {
    setIsLoading(true)
    try {
      for (const groupId of selectedIds) {
        await fetch(`/api/projects/${projectId}/moodboard/link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId }),
        })
      }
      setOpen(false)
      setSelectedIds([])
      onLink()
    } catch (error) {
      alert("Error linking moodboards")
    } finally {
      setIsLoading(false)
    }
  }

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          {t('moodboard.addFromCollection')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('moodboard.privateCollection')}</DialogTitle>
          <DialogDescription>
            Wähle Moodboards aus deiner Sammlung aus, um sie mit diesem Projekt zu verknüpfen.
          </DialogDescription>
        </DialogHeader>

        <div className="relative my-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder={t('common.search') || "Suchen..."} 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-[300px] pr-2">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {t('moodboard.noMoodboardsFound')}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredGroups.map((group) => {
                const isSelected = selectedIds.includes(group.id)
                return (
                  <div 
                    key={group.id}
                    onClick={() => toggleSelection(group.id)}
                    className={`relative cursor-pointer rounded-xl border-2 transition-all overflow-hidden ${
                      isSelected ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="aspect-video bg-gray-100 relative">
                      {group.images?.[0] ? (
                        <img src={gridThumbUrl(group.images[0])} loading="lazy" decoding="async" className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          {t('moodboard.noImage')}
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1 shadow-lg">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-white">
                      <div className="font-bold text-sm truncate">{group.name}</div>
                      <div className="text-xs text-gray-500">{t('project.imagesCount').replace('{count}', (group.images?.length || 0).toString())}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleLink} disabled={selectedIds.length === 0 || isLoading}>
            {isLoading ? t('moodboard.linking') : t('moodboard.addSelection').replace('{count}', selectedIds.length.toString())}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
