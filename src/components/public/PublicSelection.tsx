"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { X, ChevronLeft, ChevronRight, Star, Folder as FolderIcon, Download, Loader2 } from "lucide-react"
import { ImageCard } from "../selection/ImageCard"
import { RatingControls } from "../selection/RatingControls"
import { useI18n } from "@/components/I18nProvider"
import { supportsDirectDownload, directDownloadViaManifest } from "@/lib/direct-download"

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
  userHasAccess?: boolean
  allowGuestSelection?: boolean
  showFolders?: boolean
  allowDownload?: boolean
  brandColor?: string | null
}

export function PublicSelection({
  projectId,
  images,
  folders,
  layout = "masonry",
  columns = 4,
  userHasAccess,
  allowGuestSelection,
  showFolders = true,
  allowDownload = false,
  brandColor
}: PublicSelectionProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isDownloadingAll, setIsDownloadingAll] = useState(false)
  const [downloadMode, setDownloadMode] = useState<'zip' | 'files'>('zip')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const canDirectDownload = supportsDirectDownload()
  const router = useRouter()
  const { t } = useI18n()

  const handleRatingUpdated = () => {
    router.refresh()
  }

  // Project members rate as themselves; everyone else (true guests OR logged-in
  // users without project access) rates as a guest when guest selection is on.
  const isGuest = !userHasAccess && !!allowGuestSelection
  const canRate = !!userHasAccess || !!allowGuestSelection

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

  // Download a single image (keeps its original file/format).
  const downloadSingle = async (image: SelectionImage) => {
    try {
      const res = await fetch(image.path)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = image.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      console.error('Download failed:', e)
    }
  }

  const endpoint = `/api/projects/${projectId}/selection/download`

  // Download the given image ids — either as a ZIP or directly as individual files.
  const runDownload = async (imageIds: string[]) => {
    if (imageIds.length === 0) return
    setIsDownloadingAll(true)
    try {
      if (downloadMode === 'files' && canDirectDownload) {
        const result = await directDownloadViaManifest(endpoint, { imageIds })
        if (result && result.failed > 0) {
          alert(t('selection.downloadPartialFailed')
            .replace('{failed}', result.failed.toString())
            .replace('{total}', imageIds.length.toString()))
        }
        return
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds }),
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'selection.zip'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      console.error('Download failed:', e)
      alert(t('common.error'))
    } finally {
      setIsDownloadingAll(false)
    }
  }

  // Download all currently shown images.
  const downloadAll = () => runDownload(filteredImages.map(img => img.id))

  // Download the marked images.
  const downloadSelected = () => runDownload(Array.from(selectedIds))

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
        <div className="flex items-center gap-2">
          {allowDownload && (
            <button
              className="p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-2xl transition-all shadow-xl backdrop-blur-md border border-white/10"
              onClick={(e) => { e.stopPropagation(); downloadSingle(filteredImages[selectedIndex]) }}
              title={t('selection.download')}
            >
              <Download className="h-6 w-6" />
            </button>
          )}
          <button
            className="p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-2xl transition-all shadow-xl backdrop-blur-md border border-white/10"
            onClick={closeLightbox}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
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
      {/* Download toolbar */}
      {allowDownload && filteredImages.length > 0 && (
        <div className="flex justify-end items-center gap-2 flex-wrap">
          {/* Download mode: ZIP vs. individual files (Chromium only) */}
          {canDirectDownload && (
            <div className="flex items-center rounded-full border border-gray-200 bg-white p-0.5 text-sm shadow-sm mr-auto">
              <button
                onClick={() => setDownloadMode('zip')}
                disabled={isDownloadingAll}
                className={`px-3 py-1.5 rounded-full font-medium transition-all ${downloadMode === 'zip' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t('selection.downloadAsZip')}
              </button>
              <button
                onClick={() => setDownloadMode('files')}
                disabled={isDownloadingAll}
                className={`px-3 py-1.5 rounded-full font-medium transition-all ${downloadMode === 'files' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t('selection.downloadAsFiles')}
              </button>
            </div>
          )}
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => setSelectedIds(new Set())}
                disabled={isDownloadingAll}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-60"
              >
                <X className="h-4 w-4" />
                {t('common.clear')}
              </button>
              <button
                onClick={downloadSelected}
                disabled={isDownloadingAll}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-amber-500 text-white border border-transparent hover:bg-amber-600 transition-all shadow-sm disabled:opacity-60"
                style={brandColor ? { backgroundColor: brandColor } : undefined}
              >
                {isDownloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {t('selection.downloadSelected').replace('{count}', selectedIds.size.toString())}
              </button>
            </>
          )}
          <button
            onClick={downloadAll}
            disabled={isDownloadingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-60"
            style={brandColor ? { color: brandColor, borderColor: `${brandColor}33` } : undefined}
          >
            {isDownloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t('selection.downloadAll')}
          </button>
        </div>
      )}

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
            style={selectedFolderId === null && brandColor ? { backgroundColor: brandColor, boxShadow: `0 10px 15px -3px ${brandColor}4d`, borderColor: 'transparent' } : undefined}
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
            style={selectedFolderId === 'unassigned' && brandColor ? { backgroundColor: brandColor, boxShadow: `0 10px 15px -3px ${brandColor}4d`, borderColor: 'transparent' } : undefined}
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
              style={selectedFolderId === folder.id && brandColor ? { backgroundColor: brandColor, boxShadow: `0 10px 15px -3px ${brandColor}4d`, borderColor: 'transparent' } : undefined}
            >
              <FolderIcon className={`h-3.5 w-3.5 ${selectedFolderId === folder.id ? 'fill-white/20' : 'text-amber-500'}`} style={selectedFolderId !== folder.id && brandColor ? { color: brandColor } : undefined} />
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
                    selected={selectedIds.has(image.id)}
                    onSelect={allowDownload ? () => toggleSelect(image.id) : undefined}
                    forceSelectable={allowDownload}
                    onDownload={allowDownload ? () => downloadSingle(image) : undefined}
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
                        selected={selectedIds.has(image.id)}
                        onSelect={allowDownload ? () => toggleSelect(image.id) : undefined}
                        forceSelectable={allowDownload}
                        onDownload={allowDownload ? () => downloadSingle(image) : undefined}
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
                          selected={selectedIds.has(image.id)}
                          onSelect={allowDownload ? () => toggleSelect(image.id) : undefined}
                          forceSelectable={allowDownload}
                          onDownload={allowDownload ? () => downloadSingle(image) : undefined}
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
