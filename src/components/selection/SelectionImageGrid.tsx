'use client';

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
  onToggleSelect
}: SelectionImageGridProps) {
  if (images.length === 0) return null;

  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {images.map((image, i) => (
          <ImageCard
            key={image.id}
            image={image}
            projectId={projectId}
            onRatingUpdated={onRatingUpdated}
            onImageClick={() => onImageClick(i)}
            selected={selectedIds?.has(image.id)}
            onSelect={onToggleSelect ? () => onToggleSelect(image.id) : undefined}
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
                onSelect={onToggleSelect ? () => onToggleSelect(image.id) : undefined}
                hideRatings={false}
              />
            </div>
          );
        })}
        <div className="flex-[1000] h-0" />
      </div>
    );
  }

  // Masonry (Default)
  return (
    <div className="flex gap-4 items-start">
      {Array.from({ length: 5 }).map((_, colIdx) => {
        const columnImages = images.filter((_, i) => i % 5 === colIdx);
        return (
          <div key={colIdx} className="flex-1 flex flex-col gap-4">
            {columnImages.map((image) => {
              const globalIndex = images.findIndex(img => img.id === image.id);
              return (
                <div key={image.id}>
                  <ImageCard
                    image={image}
                    projectId={projectId}
                    onRatingUpdated={onRatingUpdated}
                    onImageClick={() => onImageClick(globalIndex)}
                    masonry={true}
                    selected={selectedIds?.has(image.id)}
                    onSelect={onToggleSelect ? () => onToggleSelect(image.id) : undefined}
                    hideRatings={false}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
