"use client"

import { useState, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ImageCard } from "./ImageCard"
import { FilterBar } from "./FilterBar"
import ImageUpload from "../moodboard/ImageUpload"
import { LocalMediaPicker } from "./LocalMediaPicker"
import { ExportDialog } from "./ExportDialog"
import { RatingControls } from "./RatingControls"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import { useI18n } from "@/components/I18nProvider"
import { SelectionFolderTree } from "./SelectionFolderTree"
import { SelectionImageGrid } from "./SelectionImageGrid"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  FolderPlus, 
  Trash2, 
  Move, 
  CheckSquare, 
  Square,
  X,
  MoreVertical,
  ChevronRight,
  ChevronDown
} from "lucide-react"
import { SelectionFolderForm } from "./SelectionFolderForm"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface Rating {
  id: string
  stars: number | null
  color: string | null
}

interface SelectionImage {
  id: string
  filename: string
  path: string
  thumbnail: string | null
  width?: number | null
  height?: number | null
  ratings: Rating | null
  folderId?: string | null
}

interface SelectionFolder {
  id: string
  name: string
  parentId: string | null
  path: string
  images: SelectionImage[]
  children?: SelectionFolder[]
}

interface SelectionContentProps {
  projectId: string
  initialImages: SelectionImage[]
  initialFolders: SelectionFolder[]
  userId: string
  galleryLayout?: string
  hasLocalMedia?: boolean
  showFolders?: boolean
}

export function SelectionContent({ 
  projectId, 
  initialImages, 
  initialFolders,
  userId, 
  galleryLayout = "grid", 
  hasLocalMedia,
  showFolders = true
}: SelectionContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useI18n()

  const [index, setIndex] = useState(-1)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set())
  const [showFolderForm, setShowFolderForm] = useState(false)
  const [editingFolder, setEditingFolder] = useState<SelectionFolder | null>(null)

  const filteredImages = useMemo(() => {
    if (selectedFolderId === 'unassigned') return initialImages.filter(img => !img.folderId)
    if (!selectedFolderId) return initialImages
    return initialImages.filter(img => img.folderId === selectedFolderId)
  }, [initialImages, selectedFolderId])

  const handleRatingUpdated = () => {
    router.refresh()
  }

  const handleToggleSelectAll = () => {
    if (selectedImageIds.size === filteredImages.length) {
      setSelectedImageIds(new Set())
    } else {
      setSelectedImageIds(new Set(filteredImages.map(img => img.id)))
    }
  }

  const handleToggleImage = (ids: string | string[]) => {
    const newSelected = new Set(selectedImageIds)
    const idArray = Array.isArray(ids) ? ids : [ids]
    
    idArray.forEach(id => {
      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.add(id)
      }
    })
    
    setSelectedImageIds(newSelected)
  }

  const handleDeleteSelected = async () => {
    if (!selectedImageIds.size || !confirm(t('selection.confirmDeleteImages'))) return

    try {
      const res = await fetch(`/api/projects/${projectId}/selection/images/bulk`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds: Array.from(selectedImageIds) })
      })

      if (!res.ok) throw new Error()
      
      toast.success(t('selection.deletedSuccess'))
      setSelectedImageIds(new Set())
      router.refresh()
    } catch (error) {
      toast.error(t('common.error'))
    }
  }

  const handleMoveSelected = async (targetFolderId: string | null) => {
    if (!selectedImageIds.size) return

    try {
      const res = await fetch(`/api/projects/${projectId}/selection/images/bulk`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageIds: Array.from(selectedImageIds),
          folderId: targetFolderId 
        })
      })

      if (!res.ok) throw new Error()
      
      toast.success(t('selection.movedSuccess'))
      setSelectedImageIds(new Set())
      router.refresh()
    } catch (error) {
      toast.error(t('common.error'))
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm(t('selection.confirmDeleteFolder'))) return

    try {
      const res = await fetch(`/api/projects/${projectId}/selection/folders?folderId=${folderId}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error()
      
      toast.success(t('selection.folderDeleted'))
      if (selectedFolderId === folderId) setSelectedFolderId(null)
      router.refresh()
    } catch (error) {
      toast.error(t('common.error'))
    }
  }

  const handleFilterChange = (filterType: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value === null) {
      params.delete(filterType)
    } else {
      const currentValues = params.getAll(filterType)
      if (currentValues.includes(value)) {
        const newValues = currentValues.filter(v => v !== value)
        params.delete(filterType)
        newValues.forEach(v => params.append(filterType, v))
      } else {
        params.append(filterType, value)
      }
    }

    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {t('selection.title')} ({initialImages.length})
          </h2>
          <div className="flex items-center gap-2">
            <ExportDialog images={initialImages} />
            {hasLocalMedia && (
              <LocalMediaPicker
                projectId={projectId}
                onSuccess={() => router.refresh()}
                importUrl={`/api/projects/${projectId}/selection/scan`}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showFolders && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingFolder(null)
                setShowFolderForm(true)
              }}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              {t('selection.newFolder')}
            </Button>
          )}
          
          {selectedImageIds.size > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              <span className="text-sm font-medium text-blue-700">
                {selectedImageIds.size} {t('selection.selected')}
              </span>
              <div className="h-4 w-px bg-blue-200 mx-1" />
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              
              {showFolders && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-blue-600">
                      <Move className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleMoveSelected(null)}>
                      {t('selection.moveToRoot')}
                    </DropdownMenuItem>
                    {initialFolders.map(folder => (
                      <DropdownMenuItem 
                        key={folder.id} 
                        onClick={() => handleMoveSelected(folder.id)}
                      >
                        {t('selection.moveTo')} {folder.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-gray-500"
                onClick={() => setSelectedImageIds(new Set())}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <FilterBar 
        onFilterChange={handleFilterChange} 
        activeStars={searchParams.getAll('stars')}
        activeColors={searchParams.getAll('color')}
      />

      <div className="flex flex-col md:flex-row gap-8 min-h-[600px]">
        {showFolders && (
          <aside className="w-full md:w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-24">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">{t('selection.folders')}</h3>
              </div>
              <div className="p-2">
                <button
                  onClick={() => setSelectedFolderId(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    selectedFolderId === null 
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-4 h-4" />
                  {t('selection.allImages')}
                </button>

                <button
                  onClick={() => setSelectedFolderId('unassigned')}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    selectedFolderId === 'unassigned'
                      ? 'bg-blue-50 text-blue-700 font-medium' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="w-4 h-4" />
                  {t('selection.unassigned')}
                </button>
                
                <SelectionFolderTree
                  folders={initialFolders}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={setSelectedFolderId}
                  onDeleteFolder={handleDeleteFolder}
                  onEditFolder={(folder) => {
                    setEditingFolder(folder)
                    setShowFolderForm(true)
                  }}
                  onMoveImages={async (imageIds, targetFolderId) => {
                    await handleMoveSelected(targetFolderId)
                  }}
                />
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1 space-y-8">
          {filteredImages.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500 text-lg">{t('common.noImages')}</p>
              <p className="text-sm text-gray-400 mt-2">{t('common.uploadPrompt')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleToggleSelectAll}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {selectedImageIds.size === filteredImages.length ? (
                    <CheckSquare className="h-4 w-4 mr-2" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  {selectedImageIds.size === filteredImages.length ? t('selection.deselectAll') : t('selection.selectAll')}
                </Button>
                <p className="text-sm text-gray-500">
                  {filteredImages.length} {t('selection.images')}
                </p>
              </div>

              <SelectionImageGrid
                images={filteredImages}
                projectId={projectId}
                layout={galleryLayout as any}
                selectedIds={selectedImageIds}
                onToggleSelect={handleToggleImage}
                onImageClick={(i) => setIndex(i)}
                onRatingUpdated={handleRatingUpdated}
              />
            </div>
          )}

          <div className="space-y-6 pt-12 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{t('selection.importImages')}</h3>
              {hasLocalMedia && (
                <LocalMediaPicker
                  projectId={projectId}
                  onSuccess={() => router.refresh()}
                  importUrl={`/api/projects/${projectId}/selection/scan`}
                  label={t('selection.importLocal')}
                />
              )}
            </div>
            <ImageUpload
              uploadUrl={`/api/projects/${projectId}/selection/images`}
              onSuccess={() => router.refresh()}
              label={t('selection.dragDrop')}
              className="w-full min-h-[160px] border-dashed bg-gray-50/50 hover:bg-gray-100/30 transition-all rounded-2xl flex flex-col items-center justify-center border-gray-200"
              folderId={selectedFolderId || undefined}
            />
          </div>
        </main>
      </div>

      <SelectionFolderForm
        isOpen={showFolderForm}
        onClose={() => {
          setShowFolderForm(false)
          setEditingFolder(null)
        }}
        projectId={projectId}
        folder={editingFolder || undefined}
        onSuccess={() => {
          setShowFolderForm(false)
          setEditingFolder(null)
          router.refresh()
        }}
      />

      <Lightbox
        index={index}
        open={index >= 0}
        close={() => setIndex(-1)}
        slides={filteredImages.map((img) => ({ 
          src: img.path,
          image: img
        }))}
        render={{
          slide: ({ slide }: any) => (
            <div className="flex flex-col items-center justify-center w-full h-full p-4 md:p-12 overflow-hidden">
              <div className="flex-1 w-full flex items-center justify-center min-h-0">
                <img 
                  src={slide.src} 
                  alt="" 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
                />
              </div>
              <div className="mt-8 shrink-0 pb-4" onClick={e => e.stopPropagation()}>
                <RatingControls 
                  projectId={projectId}
                  imageId={slide.image.id}
                  initialRating={slide.image.ratings}
                  onRatingUpdated={handleRatingUpdated}
                />
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}
