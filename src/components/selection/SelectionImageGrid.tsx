"use client";

import { ImageCard } from "./ImageCard";

interface SelectionImageGridProps {
  images: any[];
  layout: "grid" | "masonry" | "justified";
  projectId: string;
  onImageClick: (index: number) => void;
  onRatingUpdated: () => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string | string[]) => void;
}

export function SelectionImageGrid({
  images,
  layout,
  projectId,
  onImageClick,
  onRatingUpdated,
  selectedIds,
  onToggleSelect,
}: SelectionImageGridProps) {
  if (images.length === 0) return null;

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {images.map((image, i) => (
          <ImageCard
            key={image.id}
            image={image}
            projectId={projectId}
            onRatingUpdated={onRatingUpdated}
            onImageClick={() => onImageClick(i)}
            selected={selectedIds?.has(image.id)}
            onSelect={
              onToggleSelect ? () => onToggleSelect(image.id) : undefined
            }
            hideRatings={false}
          />
        ))}
      </div>
    );
  }

  if (layout === "justified") {
    return (
      <div className="flex flex-wrap gap-4">
        {images.map((image, i) => {
          const width = image.width || 400;
          const height = image.height || 300;
          const aspect = width / height;
          return (
            <div
              key={image.id}
              className="relative group h-[340px]"
              style={{
                flexGrow: aspect * 100,
                flexBasis: `${aspect * 240}px`,
              }}
            >
              <ImageCard
                image={image}
                projectId={projectId}
                onRatingUpdated={onRatingUpdated}
                onImageClick={() => onImageClick(i)}
                justified={true}
                selected={selectedIds?.has(image.id)}
                onSelect={
                  onToggleSelect ? () => onToggleSelect(image.id) : undefined
                }
                hideRatings={false}
              />
            </div>
          );
        })}
        <div className="flex-[1000] h-0" />
      </div>
    );
  }

  return (
    <div className="columns-2 gap-3 xl:columns-3 2xl:columns-4">
      {images.map((image, index) => (
        <div key={image.id} className="mb-3 break-inside-avoid">
          <ImageCard
            image={image}
            projectId={projectId}
            onRatingUpdated={onRatingUpdated}
            onImageClick={() => onImageClick(index)}
            masonry
            selected={selectedIds?.has(image.id)}
            onSelect={
              onToggleSelect ? () => onToggleSelect(image.id) : undefined
            }
          />
        </div>
      ))}
    </div>
  );
}
