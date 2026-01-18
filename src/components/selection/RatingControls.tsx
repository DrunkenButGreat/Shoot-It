"use client"

import { useState, useEffect } from "react"
import { Star } from "lucide-react"

interface Rating {
  id: string
  stars: number | null
  color: string | null
}

interface RatingControlsProps {
  projectId: string
  imageId: string
  initialRating?: Rating
  onRatingUpdated?: () => void
  disabled?: boolean
  className?: string
  isGuest?: boolean
}

export function RatingControls({
  projectId,
  imageId,
  initialRating,
  onRatingUpdated,
  disabled: externalDisabled,
  className,
  isGuest
}: RatingControlsProps) {
  const [stars, setStars] = useState<number>(initialRating?.stars || 0)
  const [color, setColor] = useState<string | null>(initialRating?.color || null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [guestId, setGuestId] = useState<string | null>(null)

  useEffect(() => {
    if (isGuest) {
      let id = document.cookie.split('; ').find(row => row.startsWith('shoot_it_guest_id='))?.split('=')[1]
      if (!id) {
        id = `guest_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`
        document.cookie = `shoot_it_guest_id=${id}; path=/; max-age=${60 * 60 * 24 * 365}`
      }
      setGuestId(id)
    }
  }, [isGuest])

  const disabled = externalDisabled || isUpdating || (isGuest && !guestId)

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
        `/api/projects/${projectId}/selection/${imageId}/rating`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            guestId: isGuest ? guestId : undefined
          }),
        }
      )

      if (response.ok) {
        onRatingUpdated?.()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to update rating")
      }
    } catch (error) {
      alert("An error occurred")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Stars */}
      <div className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            onClick={() => handleStarClick(rating)}
            disabled={disabled}
            className="disabled:opacity-50 transition-all hover:scale-110"
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
      <div className="flex justify-center gap-2">
        {(["RED", "YELLOW", "GREEN"] as const).map((c) => {
          const bgColors: Record<string, string> = {
            RED: color === "RED" ? "bg-red-500 border-red-700" : "bg-red-200 border-red-300 hover:bg-red-300",
            YELLOW: color === "YELLOW" ? "bg-yellow-500 border-yellow-700" : "bg-yellow-200 border-yellow-300 hover:bg-yellow-300",
            GREEN: color === "GREEN" ? "bg-green-500 border-green-700" : "bg-green-200 border-green-300 hover:bg-green-300",
          }
          return (
            <button
              key={c}
              onClick={() => handleColorClick(c)}
              disabled={disabled}
              className={`w-6 h-6 rounded-full border-2 ${bgColors[c]} disabled:opacity-50 transition-all hover:scale-110`}
            />
          )
        })}
      </div>
    </div>
  )
}
