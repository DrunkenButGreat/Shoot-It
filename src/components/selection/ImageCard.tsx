"use client"

import { useState } from "react"
import { Star } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

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
  ratings: Rating[]
}

interface ImageCardProps {
  image: SelectionImage
  projectId: string
  onRatingUpdated?: () => void
  onImageClick?: () => void
  masonry?: boolean
  justified?: boolean
}

export function ImageCard({ image, projectId, onRatingUpdated, onImageClick, masonry, justified }: ImageCardProps) {
  const currentRating = image.ratings[0]
  const [stars, setStars] = useState<number>(currentRating?.stars || 0)
  const [color, setColor] = useState<string | null>(currentRating?.color || null)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStarClick = async (rating: number) => {
    const newStars = stars === rating ? 0 : rating
    setStars(newStars)
    await updateRating({ stars: newStars > 0 ? newStars : null, color })
  }

  const handleColorClick = async (newColor: string) => {
    const selectedColor = color === newColor ? null : newColor
    setColor(selectedColor)
    await updateRating({ stars: stars > 0 ? stars : null, color: selectedColor })
  }

  const updateRating = async (data: { stars: number | null; color: string | null }) => {
    setIsUpdating(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/selection/${image.id}/rating`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      )

      if (response.ok) {
        onRatingUpdated?.()
      } else {
        alert("Failed to update rating")
      }
    } catch (error) {
      alert("An error occurred")
    } finally {
      setIsUpdating(false)
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
    <Card className={`overflow-hidden ${color ? getColorClass(color) : ""} ${justified ? "h-full flex flex-col" : ""}`}>
      {/* Image */}
      <div
        className={`${justified ? "h-[240px]" : masonry ? "" : "aspect-square"} bg-gray-100 relative overflow-hidden cursor-zoom-in group flex-shrink-0`}
        onClick={onImageClick}
      >
        {image.path ? (
          <img
            src={image.path}
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
      <div className="p-3 space-y-2">
        {/* Stars */}
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              onClick={() => handleStarClick(rating)}
              disabled={isUpdating}
              className="disabled:opacity-50"
            >
              <Star
                className={`h-5 w-5 ${rating <= stars
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
                  }`}
              />
            </button>
          ))}
        </div>

        {/* Color labels */}
        <div className="flex justify-center gap-1">
          <button
            onClick={() => handleColorClick("RED")}
            disabled={isUpdating}
            className={`w-6 h-6 rounded-full border-2 ${color === "RED"
              ? "bg-red-500 border-red-700"
              : "bg-red-200 border-red-300 hover:bg-red-300"
              } disabled:opacity-50`}
          />
          <button
            onClick={() => handleColorClick("YELLOW")}
            disabled={isUpdating}
            className={`w-6 h-6 rounded-full border-2 ${color === "YELLOW"
              ? "bg-yellow-500 border-yellow-700"
              : "bg-yellow-200 border-yellow-300 hover:bg-yellow-300"
              } disabled:opacity-50`}
          />
          <button
            onClick={() => handleColorClick("GREEN")}
            disabled={isUpdating}
            className={`w-6 h-6 rounded-full border-2 ${color === "GREEN"
              ? "bg-green-500 border-green-700"
              : "bg-green-200 border-green-300 hover:bg-green-300"
              } disabled:opacity-50`}
          />
        </div>
      </div>
    </Card>
  )
}
