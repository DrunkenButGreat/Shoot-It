"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ImageCard } from "./ImageCard"
import { FilterBar } from "./FilterBar"

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

interface SelectionContentProps {
  projectId: string
  initialImages: SelectionImage[]
  userId: string
}

export function SelectionContent({ projectId, initialImages, userId }: SelectionContentProps) {
  const [images] = useState(initialImages)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleRatingUpdated = () => {
    router.refresh()
  }

  const handleFilterChange = (filterType: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (value) {
      params.set(filterType, value)
    } else {
      params.delete(filterType)
    }

    router.push(`?${params.toString()}`)
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">
            Selection Gallery ({images.length} images)
          </h2>
        </div>
        <FilterBar onFilterChange={handleFilterChange} />
      </div>

      {images.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">No images yet</p>
          <p className="text-sm text-gray-400 mt-2">Import images to start rating and selecting</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {images.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              projectId={projectId}
              onRatingUpdated={handleRatingUpdated}
            />
          ))}
        </div>
      )}
    </>
  )
}
