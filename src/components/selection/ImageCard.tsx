"use client"

import { useRef, useState } from "react"
import { Star, Check, Play, Download } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RatingControls } from "./RatingControls"

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
  ratings: Rating | null
  isVideo?: boolean
  duration?: number | null
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

interface ImageCardProps {
  image: SelectionImage
  projectId: string
  onRatingUpdated?: () => void
  onImageClick?: () => void
  masonry?: boolean
  justified?: boolean
  readOnly?: boolean
  isGuest?: boolean
  selected?: boolean
  onSelect?: () => void
  hideRatings?: boolean
  onDownload?: () => void
  forceSelectable?: boolean
}

export function ImageCard({
  image,
  projectId,
  onRatingUpdated,
  onImageClick,
  masonry,
  justified,
  readOnly,
  isGuest,
  selected,
  onSelect,
  hideRatings,
  onDownload,
  forceSelectable
}: ImageCardProps) {
  const currentRating = image.ratings
  const color = currentRating?.color || null
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleMouseEnter = () => {
    const v = videoRef.current
    if (v) {
      v.play().catch(() => {})
    }
  }

  const handleMouseLeave = () => {
    const v = videoRef.current
    if (v) {
      v.pause()
      v.currentTime = 0
    }
  }

  const getColorClass = (colorName: string) => {
    switch (colorName) {
      case "RED":
        return "border-red-500 border-4"
      case "YELLOW":
        return "border-yellow-500 border-4"
      case "GREEN":
        return "border-green-500 border-4"
      default:
        return ""
    }
  }

  return (
    <Card 
      draggable={!readOnly && !isGuest}
      onDragStart={(e) => {
        if (!readOnly && !isGuest) {
          e.dataTransfer.setData("application/json", JSON.stringify({ imageId: image.id }));
          e.dataTransfer.effectAllowed = "move";
        }
      }}
      className={`overflow-hidden relative group transition-all duration-200 ${selected ? "ring-2 ring-blue-500 shadow-md" : ""} ${color ? getColorClass(color) : ""} ${justified ? "h-full flex flex-col" : ""}`}
    >
      {/* Selection Checkbox */}
      {((!readOnly && !isGuest) || forceSelectable) && onSelect && (
        <div
          className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md border-2 border-white/50 backdrop-blur-md flex items-center justify-center cursor-pointer transition-all ${selected ? 'bg-blue-500 border-blue-500 opacity-100' : 'bg-black/20 opacity-0 group-hover:opacity-100 hover:bg-black/40'}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
        >
          {selected && <Check className="w-4 h-4 text-white" />}
        </div>
      )}

      {/* Download button */}
      {onDownload && (
        <button
          className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          title={image.filename}
        >
          <Download className="w-4 h-4" />
        </button>
      )}

      {/* Media */}
      <div
        className={`${justified ? "h-[240px]" : masonry ? "" : "aspect-square"} bg-gray-100 relative overflow-hidden cursor-zoom-in group flex-shrink-0`}
        onClick={onImageClick}
        onMouseEnter={image.isVideo ? handleMouseEnter : undefined}
        onMouseLeave={image.isVideo ? handleMouseLeave : undefined}
      >
        {image.isVideo ? (
          <>
            <video
              ref={videoRef}
              src={`${image.path}#t=0.1`}
              poster={image.thumbnail || undefined}
              muted
              loop
              playsInline
              preload="metadata"
              className={`w-full ${justified || !masonry ? "h-full object-cover" : "h-auto"}`}
              draggable={false}
            />
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity duration-200">
              <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
                <Play className="w-6 h-6 text-white fill-white" />
              </div>
            </div>
            {/* Duration badge */}
            {image.duration ? (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-medium px-1.5 py-0.5 rounded pointer-events-none">
                {formatDuration(image.duration)}
              </div>
            ) : null}
          </>
        ) : (image.thumbnail || image.path) ? (
          <img
            src={image.thumbnail || image.path}
            alt={image.filename}
            className={`w-full ${justified || !masonry ? "h-full object-cover" : "h-auto"} group-hover:scale-105 transition-transform duration-300`}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs p-2 text-center break-all">
            {image.filename}
          </div>
        )}
      </div>

      {/* Rating controls */}
      {!hideRatings && (
        <div className="p-3">
          <RatingControls
            projectId={projectId}
            imageId={image.id}
            initialRating={currentRating || undefined}
            onRatingUpdated={onRatingUpdated}
            disabled={readOnly}
            isGuest={isGuest}
          />
        </div>
      )}
    </Card>
  )
}
