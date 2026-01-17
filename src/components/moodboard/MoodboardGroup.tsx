"use client"

import { useState, useEffect } from "react"
import { Archive, ArchiveRestore, Check, Link as LinkIcon, MessageSquare, Trash2, X, Download, CheckSquare, Square, Loader2, ChevronDown, ChevronRight, Heart } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ImageUpload from "./ImageUpload"
import { LocalMediaPicker } from "../selection/LocalMediaPicker"
import { useI18n } from "@/components/I18nProvider"
import { useSession } from "next-auth/react"

import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

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
  isFavorite: boolean
  isLibrary: boolean
  order: number
  status: string
  images: MoodboardImage[]
  comments: Comment[]
}

interface MoodboardGroupProps {
  group: Group
  projectId: string
  galleryLayout?: string
  hasLocalMedia?: boolean
  onUpdate?: () => void
  onDelete?: () => void
  isInitiallyCollapsed?: boolean
  showFavorites?: boolean
}

export function MoodboardGroup({ group, projectId, galleryLayout, hasLocalMedia, onUpdate, onDelete, isInitiallyCollapsed, showFavorites = false }: MoodboardGroupProps) {
  const { data: session } = useSession()
  const { t, locale } = useI18n()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [index, setIndex] = useState(-1)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeletingImages, setIsDeletingImages] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(isInitiallyCollapsed ?? false)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)

  useEffect(() => {
    if (isInitiallyCollapsed !== undefined) {
      setIsCollapsed(isInitiallyCollapsed)
    }
  }, [isInitiallyCollapsed])

  const isOwner = session?.user?.id === group.ownerId
  const isLinked = projectId !== ""
  const isLibrary = group.isLibrary

  const handleDelete = async () => {
    const confirmMessage = isLinked 
      ? t('moodboard.deleteGroupConfirm').replace('{name}', group.name) // We might want a different text for "Unlink"
      : t('moodboard.deleteGroupConfirm').replace('{name}', group.name)

    if (!confirm(confirmMessage)) {
      return
    }

    setIsDeleting(true)
    try {
      const url = isLinked 
        ? `/api/projects/${projectId}/moodboard/groups/${group.id}` 
        : `/api/user/moodboards/${group.id}`
        
      const response = await fetch(url, { method: "DELETE" })

      if (response.ok) {
        onDelete?.()
      } else {
        alert(t('moodboard.deleteGroupError'))
      }
    } catch (error) {
      alert(t('common.error'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleFavorite = async () => {
    setIsTogglingFavorite(true)
    try {
      const url = isLinked 
        ? `/api/projects/${projectId}/moodboard/groups/${group.id}` 
        : `/api/user/moodboards/${group.id}`

      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !group.isFavorite }),
      })

      if (response.ok) {
        onUpdate?.()
      }
    } catch (error) {
      console.error("Favorite toggle error:", error)
    } finally {
      setIsTogglingFavorite(false)
    }
  }

  const handleArchive = async () => {
    try {
      const response = await fetch(`/api/user/moodboards/${group.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !group.isArchived }),
      })

      if (response.ok) {
        onUpdate?.()
      }
    } catch (error) {
      alert("An error occurred")
    }
  }

  const handleStatusChange = async (status: string) => {
    if (!isLinked) return
    try {
      const response = await fetch(
        `/api/projects/${projectId}/moodboard/groups/${group.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      )

      if (response.ok) {
        onUpdate?.()
      } else {
        alert("Failed to update status")
      }
    } catch (error) {
      alert("An error occurred")
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    setIsAddingComment(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/moodboard/groups/${group.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newComment }),
        }
      )

      if (response.ok) {
        setNewComment("")
        onUpdate?.()
      } else {
        alert("Failed to add comment")
      }
    } catch (error) {
      alert("An error occurred")
    } finally {
      setIsAddingComment(false)
    }
  }

  const handleDownload = async (imageIds: string[] = [], groupIds: string[] = []) => {
    if (imageIds.length === 0 && groupIds.length === 0) return

    setIsDownloading(true)
    try {
      const response = await fetch('/api/moodboards/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds, groupIds }),
      })

      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = groupIds.length > 0 ? `${group.name}_images.zip` : `moodboard_selection.zip`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download error:', error)
      alert(t('common.error'))
    } finally {
      setIsDownloading(false)
    }
  }

  const handleDeleteImages = async (imageIds: string[]) => {
    const confirmMessage = imageIds.length === 1 
      ? t('moodboard.deleteImageConfirm') 
      : t('moodboard.deleteImagesConfirm').replace('{count}', imageIds.length.toString())

    if (!confirm(confirmMessage)) return

    setIsDeletingImages(true)
    try {
      const response = await fetch('/api/moodboards/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds }),
      })

      if (response.ok) {
        setSelectedImageIds([])
        onUpdate?.()
      } else {
        alert(t('common.error'))
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert(t('common.error'))
    } finally {
      setIsDeletingImages(false)
    }
  }

  const toggleSelectImage = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation()
    setSelectedImageIds(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId) 
        : [...prev, imageId]
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "bg-green-100 text-green-800 border-green-300"
      case "REJECTED":
        return "bg-red-100 text-red-800 border-red-300"
      default:
        return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "Accepted"
      case "REJECTED":
        return "Rejected"
      default:
        return "Pending"
    }
  }

  return (
    <div className={isLibrary && !isOwner ? "pointer-events-none opacity-80" : ""}>
      {isLibrary && !isOwner && (
        <div className="bg-amber-50 text-amber-700 text-[10px] px-2 py-0.5 border-b border-amber-100 flex items-center gap-1 justify-center rounded-t-xl">
          <X className="h-3 w-3" /> {t('moodboard.ownerOnlyEdit')}
        </div>
      )}
      <ImageUpload
        uploadUrl={isLinked 
          ? `/api/projects/${projectId}/moodboard/groups/${group.id}/images`
          : `/api/user/moodboards/${group.id}/images` 
        }
        onSuccess={() => onUpdate?.()}
        className="block"
        disabled={isLibrary && !isOwner}
      >
        <Card className={isLibrary && !isOwner ? "rounded-t-none" : ""}>
          <CardHeader className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b rounded-t-xl transition-all">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-1 h-8 w-8 text-gray-400 hover:text-gray-900"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsCollapsed(!isCollapsed);
                  }}
                >
                  {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
                <div className="flex-1 min-w-0" onClick={() => setIsCollapsed(!isCollapsed)} style={{ cursor: 'pointer' }}>
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center gap-2 truncate">
                      <CardTitle className="truncate">{group.name}</CardTitle>
                      {isLinked && group.isLibrary && (
                        <span title={t('moodboard.linked')}>
                          <LinkIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                    {isLinked && (
                      <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${getStatusColor(group.status)} flex-shrink-0`}>
                        {getStatusLabel(group.status)}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-normal">
                      ({t('project.imagesCount').replace('{count}', group.images.length.toString())})
                    </span>
                  </div>
                  {group.description && !isCollapsed && (
                    <CardDescription className="line-clamp-1">{group.description}</CardDescription>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {isOwner && showFavorites && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleFavorite();
                    }}
                    disabled={isTogglingFavorite}
                    title={group.isFavorite ? t('common.unfavorite') : t('common.favorite')}
                  >
                    <Heart className={`h-4 w-4 ${group.isFavorite ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
                  </Button>
                )}

                {isOwner && (
                  <>
                    {selectedImageIds.length > 0 ? (
                      <div className="flex gap-1 items-center bg-gray-100 p-1 rounded-lg">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(selectedImageIds)}
                          disabled={isDownloading}
                          title={t('moodboard.downloadSelected').replace('{count}', selectedImageIds.length.toString())}
                        >
                          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 text-blue-600" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteImages(selectedImageIds)}
                          disabled={isDeletingImages}
                          title={t('moodboard.deleteSelected').replace('{count}', selectedImageIds.length.toString())}
                        >
                          {isDeletingImages ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-red-600" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedImageIds([])}
                          title={t('common.clear')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload([], [group.id])}
                        disabled={isDownloading || group.images.length === 0}
                        title={t('moodboard.downloadAll')}
                      >
                        {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </Button>
                    )}
                  </>
                )}
                
                {isLinked && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange("ACCEPTED")}
                      disabled={group.status === "ACCEPTED"}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStatusChange("REJECTED")}
                      disabled={group.status === "REJECTED"}
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowComments(!showComments)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {group.comments?.length > 0 && (
                        <span className="ml-1 text-xs">{group.comments.length}</span>
                      )}
                    </Button>
                  </>
                )}
                
                {!isLinked && isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleArchive}
                    title={group.isArchived ? t('moodboard.unarchive') : t('moodboard.archive')}
                  >
                    {group.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                )}

                {(isOwner || isLinked) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        {!isCollapsed && (
          <CardContent>
            <div className="space-y-6 pt-6">
            {galleryLayout === "grid" ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {group.images.map((image, i) => {
                  const isSelected = selectedImageIds.includes(image.id)
                  return (
                    <div
                      key={image.id}
                      className={`relative aspect-square bg-gray-100 rounded-xl overflow-hidden border transition-all group ${
                        isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'
                      } cursor-zoom-in`}
                      onClick={() => setIndex(i)}
                    >
                      <img
                        src={image.path}
                        alt={image.filename}
                        className="w-full h-full object-cover"
                      />
                      
                      {isOwner && (
                        <>
                          <div 
                            className={`absolute top-2 left-2 z-10 p-1 rounded-md transition-opacity ${
                              isSelected ? 'opacity-100 bg-blue-500' : 'opacity-0 group-hover:opacity-100 bg-black/40 hover:bg-black/60'
                            }`}
                            onClick={(e) => toggleSelectImage(e, image.id)}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-white" />
                            ) : (
                              <Square className="h-4 w-4 text-white" />
                            )}
                          </div>

                          <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-1.5 bg-black/40 hover:bg-black/60 rounded-md text-white transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownload([image.id])
                              }}
                              title={t('moodboard.downloadImage')}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="p-1.5 bg-black/40 hover:bg-red-600/80 rounded-md text-white transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteImages([image.id])
                              }}
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : galleryLayout === "justified" ? (
              <div className="flex flex-wrap gap-4">
                {group.images.map((image, i) => {
                  const width = (image as any).width || 400
                  const height = (image as any).height || 300
                  const aspect = width / height
                  const isSelected = selectedImageIds.includes(image.id)
                  
                  return (
                    <div
                      key={image.id}
                      className={`relative bg-gray-100 rounded-xl overflow-hidden border transition-all group h-[200px] ${
                        isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'
                      } cursor-zoom-in`}
                      style={{
                        flexGrow: aspect * 100,
                        flexBasis: `${aspect * 150}px`,
                      }}
                      onClick={() => setIndex(i)}
                    >
                      <img
                        src={image.path}
                        alt={image.filename}
                        className="w-full h-full object-cover"
                      />

                      {isOwner && (
                        <>
                          <div 
                            className={`absolute top-2 left-2 z-10 p-1 rounded-md transition-opacity ${
                              isSelected ? 'opacity-100 bg-blue-500' : 'opacity-0 group-hover:opacity-100 bg-black/40 hover:bg-black/60'
                            }`}
                            onClick={(e) => toggleSelectImage(e, image.id)}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-white" />
                            ) : (
                              <Square className="h-4 w-4 text-white" />
                            )}
                          </div>

                          <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="p-1.5 bg-black/40 hover:bg-black/60 rounded-md text-white transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownload([image.id])
                              }}
                              title={t('moodboard.downloadImage')}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="p-1.5 bg-black/40 hover:bg-red-600/80 rounded-md text-white transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteImages([image.id])
                              }}
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
                <div className="flex-[1000] h-0" />
              </div>
            ) : (
              <div className="flex gap-4 items-start">
                {Array.from({ length: 4 }).map((_, colIdx) => {
                  const columnImages = group.images.filter((_, i) => i % 4 === colIdx)

                  return (
                    <div key={colIdx} className="flex-1 flex flex-col gap-4">
                      {columnImages.map((image) => {
                        const globalIndex = group.images.findIndex(img => img.id === image.id)
                        const isSelected = selectedImageIds.includes(image.id)
                        return (
                          <div
                            key={image.id}
                            className={`relative bg-gray-100 rounded-xl overflow-hidden border transition-all group ${
                              isSelected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'
                            } cursor-zoom-in`}
                            onClick={() => setIndex(globalIndex)}
                          >
                            <img
                              src={image.path}
                              alt={image.filename}
                              className="w-full h-auto block"
                            />

                            {isOwner && (
                              <>
                                <div 
                                  className={`absolute top-2 left-2 z-10 p-1 rounded-md transition-opacity ${
                                    isSelected ? 'opacity-100 bg-blue-500' : 'opacity-0 group-hover:opacity-100 bg-black/40 hover:bg-black/60'
                                  }`}
                                  onClick={(e) => toggleSelectImage(e, image.id)}
                                >
                                  {isSelected ? (
                                    <CheckSquare className="h-4 w-4 text-white" />
                                  ) : (
                                    <Square className="h-4 w-4 text-white" />
                                  )}
                                </div>

                                <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    className="p-1.5 bg-black/40 hover:bg-black/60 rounded-md text-white transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDownload([image.id])
                                    }}
                                    title={t('moodboard.downloadImage')}
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    className="p-1.5 bg-black/40 hover:bg-red-600/80 rounded-md text-white transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteImages([image.id])
                                    }}
                                    title={t('common.delete')}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}

            {(isOwner || !isLibrary) && (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t('selection.importImages')}</h4>
                  {hasLocalMedia && (
                    <LocalMediaPicker
                      projectId={projectId}
                      onSuccess={() => onUpdate?.()}
                      importUrl={isLinked 
                        ? `/api/projects/${projectId}/moodboard/groups/${group.id}/scan`
                        : `/api/user/moodboards/${group.id}/scan`
                      }
                      label={t('selection.importToGroup')}
                    />
                  )}
                </div>
                <ImageUpload
                  uploadUrl={isLinked 
                    ? `/api/projects/${projectId}/moodboard/groups/${group.id}/images`
                    : `/api/user/moodboards/${group.id}/images`
                  }
                  onSuccess={() => onUpdate?.()}
                  className="w-full min-h-[120px] border-dashed bg-gray-50/50 hover:bg-gray-100/30 transition-all rounded-2xl flex flex-col items-center justify-center border-gray-200"
                  label={t('selection.dragDrop')}
                />
              </div>
            )}
          </div>

          <Lightbox
            index={index}
            open={index >= 0}
            close={() => setIndex(-1)}
            slides={group.images.map((img) => ({ src: img.path }))}
          />

          {/* Comments section */}
          {showComments && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-3">Comments ({group.comments.length})</h4>
              <div className="space-y-3 mb-4">
                {group.comments.map((comment) => (
                  <div key={comment.id} className="bg-gray-50 rounded p-3">
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-sm">
                        {comment.user.name || comment.user.email}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleDateString(locale)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  disabled={isAddingComment}
                />
                <Button type="submit" disabled={isAddingComment || !newComment.trim()}>
                  {isAddingComment ? "Adding..." : "Add"}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
        )}
      </Card>
    </ImageUpload>
    </div>
  )
}
