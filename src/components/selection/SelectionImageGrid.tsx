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

  // Masonry (Default) — responsive CSS columns
  return (
    <div className="columns-2 sm:columns-3 lg:columns-5 gap-4">
      {images.map((image, i) => (
        <div key={image.id} className="break-inside-avoid mb-4">
          <ImageCard
            image={image}
            projectId={projectId}
            onRatingUpdated={onRatingUpdated}
            onImageClick={() => onImageClick(i)}
            masonry={true}
            selected={selectedIds?.has(image.id)}
            onSelect={onToggleSelect ? () => onToggleSelect(image.id) : undefined}
            hideRatings={false}
          />
        </div>
      ))}
    </div>
  );
}
