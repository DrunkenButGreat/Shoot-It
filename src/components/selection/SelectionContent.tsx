"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ImageCard } from "./ImageCard"
import { FilterBar } from "./FilterBar"
import ImageUpload from "../moodboard/ImageUpload"
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"

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
  ratings: Rating[]
}

interface SelectionContentProps {
  projectId: string
  initialImages: SelectionImage[]
  userId: string
  galleryLayout?: string
}

export function SelectionContent({ projectId, initialImages: images, userId, galleryLayout }: SelectionContentProps) {
  const [index, setIndex] = useState(-1)
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
        <div className="space-y-8">
          {galleryLayout === "grid" ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {images.map((image, i) => (
                <ImageCard
                  key={image.id}
                  image={image}
                  projectId={projectId}
                  onRatingUpdated={handleRatingUpdated}
                  onImageClick={() => setIndex(i)}
                />
              ))}
            </div>
          ) : galleryLayout === "justified" ? (
            <div className="flex flex-wrap gap-4">
              {images.map((image, i) => {
                const width = image.width || 400
                const height = image.height || 300
                const aspect = width / height
                return (
                  <div
                    key={image.id}
                    className="relative group h-[340px]"
                    style={{
                      flexGrow: aspect * 100,
                      flexBasis: `${aspect * 200}px`,
                    }}
                  >
                    <ImageCard
                      image={image}
                      projectId={projectId}
                      onRatingUpdated={handleRatingUpdated}
                      onImageClick={() => setIndex(i)}
                      justified={true}
                    />
                  </div>
                )
              })}
              <div className="flex-[1000] h-0" />
            </div>
          ) : (
            <div className="flex gap-4 items-start">
              {Array.from({ length: 5 }).map((_, colIdx) => {
                const columnImages = images.filter((_, i) => i % 5 === colIdx)

                return (
                  <div key={colIdx} className="flex-1 flex flex-col gap-4">
                    {columnImages.map((image) => {
                      const globalIndex = images.findIndex(img => img.id === image.id)
                      return (
                        <div key={image.id}>
                          <ImageCard
                            image={image}
                            projectId={projectId}
                            onRatingUpdated={handleRatingUpdated}
                            onImageClick={() => setIndex(globalIndex)}
                            masonry={true}
                          />
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          <ImageUpload
            uploadUrl={`/api/projects/${projectId}/selection/images`}
            onSuccess={() => router.refresh()}
            label="Import Images to Selection"
            className="w-full min-h-[160px] border-dashed bg-gray-50/50 hover:bg-gray-100/30 transition-all rounded-2xl flex flex-col items-center justify-center border-gray-200"
          />
        </div>
      )}

      <Lightbox
        index={index}
        open={index >= 0}
        close={() => setIndex(-1)}
        slides={images.map((img) => ({ src: img.path }))}
      />
    </>
  )
}
