"use client"

import { useState } from "react"
import { Star } from "lucide-react"
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
}

export function ImageCard({ image, projectId, onRatingUpdated, onImageClick, masonry, justified, readOnly, isGuest }: ImageCardProps) {
  const currentRating = image.ratings
  const color = currentRating?.color || null

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
    <Card className={`overflow-hidden ${color ? getColorClass(color) : ""} ${justified ? "h-full flex flex-col" : ""}`}>
      {/* Image */}
      <div
        className={`${justified ? "h-[240px]" : masonry ? "" : "aspect-square"} bg-gray-100 relative overflow-hidden cursor-zoom-in group flex-shrink-0`}
        onClick={onImageClick}
      >
        {(image.thumbnail || image.path) ? (
          <img
            src={image.thumbnail || image.path}
            alt={image.filename}
            className={`w-full ${justified || !masonry ? "h-full object-cover" : "h-auto"} group-hover:scale-105 transition-transform duration-300`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs p-2 text-center break-all">
            {image.filename}
          </div>
        )}
      </div>

      {/* Rating controls */}
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
    </Card>
  )
}
