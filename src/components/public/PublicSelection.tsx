"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { X, ChevronLeft, ChevronRight, Star, Folder as FolderIcon } from "lucide-react"
import { ImageCard } from "../selection/ImageCard"
import { RatingControls } from "../selection/RatingControls"
import { useI18n } from "@/components/I18nProvider"

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

interface PublicSelectionProps {
  projectId: string
  images: SelectionImage[]
  folders: SelectionFolder[]
  layout?: "grid" | "masonry" | "justified"
  columns?: number
  userId?: string
  allowGuestSelection?: boolean
  showFolders?: boolean
}

export function PublicSelection({
  projectId,
  images,
  folders,
  layout = "masonry",
  columns = 4,
  userId,
  allowGuestSelection,
  showFolders = true
}: PublicSelectionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { t } = useI18n()

  const handleRatingUpdated = () => {
    router.refresh()
  }

  const isGuest = !userId && allowGuestSelection
  const canRate = !!userId || !!allowGuestSelection

  const filteredImages = images.filter(img => {
    if (selectedFolderId === 'unassigned') return !img.folderId
    if (!selectedFolderId) return true
    return img.folderId === selectedFolderId
  })

  // Organize folders into a tree structure
  const folderTree = folders.filter(f => !f.parentId).map(folder => {
    const buildTree = (f: SelectionFolder): SelectionFolder => ({
      ...f,
      children: folders.filter(child => child.parentId === f.id).map(buildTree)
    })
    return buildTree(folder)
  })

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return
      if (e.key === "Escape") closeLightbox()
      if (e.key === "ArrowRight") nextImage()
      if (e.key === "ArrowLeft") prevImage()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedIndex])

  const openLightbox = (index: number) => {
    setSelectedIndex(index)
    document.body.style.overflow = 'hidden'
  }

  const closeLightbox = () => {
    setSelectedIndex(null)
    document.body.style.overflow = 'unset'
  }

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % filteredImages.length)
    }
  }

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + filteredImages.length) % filteredImages.length)
    }
  }

  const getColumnsData = () => {
    const cols: { image: SelectionImage; index: number }[][] = Array.from({ length: columns }, () => [])
    filteredImages.forEach((image, index) => {
      cols[index % columns].push({ image, index })
    })
    return cols
  }

  // Get flat list of folders with names that show their hierarchy
  const getFlatFolders = (folderList: SelectionFolder[], prefix = ''): { id: string, name: string }[] => {
    let flat: { id: string, name: string }[] = []
    folderList.forEach(folder => {
      const name = prefix ? `${prefix} / ${folder.name}` : folder.name
      flat.push({ id: folder.id, name })
      if (folder.children && folder.children.length > 0) {
        flat = [...flat, ...getFlatFolders(folder.children, name)]
      }
    })
    return flat
  }

  const flatFolders = getFlatFolders(folderTree)

  const lightbox = selectedIndex !== null && mounted ? createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300"
      onClick={closeLightbox}
    >
      {/* Lightbox Header */}
      <div className="h-20 flex items-center justify-between px-6 md:px-10 bg-gradient-to-b from-black/60 to-transparent shrink-0">
        <div className="text-white/80">
          <p className="text-sm font-bold uppercase tracking-widest">{images[selectedIndex].filename}</p>
          <p className="text-xs text-white/50">{selectedIndex + 1} / {images.length}</p>
        </div>
        <button
          className="p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-2xl transition-all shadow-xl backdrop-blur-md border border-white/10"
          onClick={closeLightbox}
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Lightbox Main Content */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden">
        {/* Navigation Buttons */}
        <button
          className="absolute left-6 top-1/2 -translate-y-1/2 p-4 md:p-6 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-3xl transition-all group z-[10000] backdrop-blur-sm border border-white/5"
          onClick={prevImage}
        >
          <ChevronLeft className="h-8 w-8 md:h-10 md:w-10 group-active:scale-90" />
        </button>

        <button
          className="absolute right-6 top-1/2 -translate-y-1/2 p-4 md:p-6 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-3xl transition-all group z-[10000] backdrop-blur-sm border border-white/5"
          onClick={nextImage}
        >
          <ChevronRight className="h-8 w-8 md:h-10 md:w-10 group-active:scale-90" />
        </button>

        <div
          className="relative flex-1 w-full flex items-center justify-center min-h-0"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={filteredImages[selectedIndex].path}
            alt={filteredImages[selectedIndex].filename}
            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-500"
          />
        </div>

        {/* Rating Controls integrated under the image */}
        <div className="mt-6 md:mt-8 shrink-0 pb-4" onClick={(e) => e.stopPropagation()}>
          {canRate ? (
            <div className="bg-black/40 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 shadow-2xl transition-all hover:bg-black/60">
              <RatingControls
                projectId={projectId}
                imageId={filteredImages[selectedIndex].id}
                initialRating={filteredImages[selectedIndex].ratings || undefined}
                onRatingUpdated={handleRatingUpdated}
                className="scale-125"
                isGuest={isGuest}
              />
            </div>
          ) : (
            <div className="text-white/50 text-xs italic bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/5">
              {t('publicProject.loginToRate')}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="flex flex-col gap-6">
      {/* Folder Breadcrumbs / Pills */}
      {showFolders && folders.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2">
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedFolderId === null
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            }`}
          >
            {t('selection.allImages')}
          </button>

          <button
            onClick={() => setSelectedFolderId('unassigned')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedFolderId === 'unassigned'
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
            }`}
          >
            {t('selection.unassigned')}
          </button>

          {flatFolders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                selectedFolderId === folder.id
                  ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-white text-gray-600 border border-gray-100 hover:bg-gray-50'
              }`}
            >
              <FolderIcon className={`h-3.5 w-3.5 ${selectedFolderId === folder.id ? 'fill-white/20' : 'text-amber-500'}`} />
              {folder.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1">
        {filteredImages.length === 0 ? (
          <div className="py-20 text-center bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
            <p className="text-gray-400">{t('common.noImages')}</p>
          </div>
        ) : (
          <>
            {layout === "grid" ? (
              <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-${columns} gap-4`}>
                {filteredImages.map((image, index) => (
                  <ImageCard
                    key={image.id}
                    image={image}
                    projectId={projectId}
                    onImageClick={() => openLightbox(index)}
                    onRatingUpdated={handleRatingUpdated}
                    readOnly={!canRate}
                    isGuest={isGuest}
                  />
                ))}
              </div>
            ) : layout === "justified" ? (
              <div className="flex flex-wrap gap-4">
                {filteredImages.map((image, index) => {
                  const width = image.width || 400
                  const height = image.height || 300
                  const aspect = width / height
                  return (
                    <div
                      key={image.id}
                      className="relative h-[340px]"
                      style={{
                        flexGrow: aspect * 100,
                        flexBasis: `${aspect * 200}px`,
                      }}
                    >
                      <ImageCard
                        image={image}
                        projectId={projectId}
                        onImageClick={() => openLightbox(index)}
                        onRatingUpdated={handleRatingUpdated}
                        justified={true}
                        readOnly={!canRate}
                        isGuest={isGuest}
                      />
                    </div>
                  )
                })}
                <div className="flex-[1000] h-0" />
              </div>
            ) : (
              /* Masonry */
              <div className={`flex gap-4 items-start`}>
                {getColumnsData().map((column, colIdx) => (
                  <div key={colIdx} className="flex-1 flex flex-col gap-4">
                    {column.map(({ image, index: globalIndex }) => (
                      <div key={image.id}>
                        <ImageCard
                          image={image}
                          projectId={projectId}
                          onImageClick={() => openLightbox(globalIndex)}
                          onRatingUpdated={handleRatingUpdated}
                          masonry={true}
                          readOnly={!canRate}
                          isGuest={isGuest}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {lightbox}
    </div>
  )
}
