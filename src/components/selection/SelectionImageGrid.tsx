"use client";

import { SelectionImageList } from "./SelectionImageList";
import { ImageCard } from "./ImageCard";
import type { RatingUpdateHandler } from "./RatingControls";

interface SelectionImageGridProps {
  images: any[];
  layout: "grid" | "masonry" | "justified" | "list";
  projectId: string;
  onImageClick: (index: number) => void;
  onRatingUpdated: RatingUpdateHandler;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string | string[]) => void;
  onDelete?: (id: string) => void;
}

export function SelectionImageGrid({
  images,
  layout,
  projectId,
  onImageClick,
  onRatingUpdated,
  selectedIds,
  onToggleSelect,
  onDelete,
}: SelectionImageGridProps) {
  if (images.length === 0) return null;

  if (layout === "list") {
    return <SelectionImageList images={images} projectId={projectId} onPreview={onImageClick} onRatingUpdated={onRatingUpdated} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onDelete={onDelete} />;
  }

  if (layout === "grid") {
    return (
      <div className="shootit-gallery-grid">
        {images.map((image, i) => (
          <ImageCard
            key={image.id}
            image={image}
            projectId={projectId}
            onDelete={onDelete ? () => onDelete(image.id) : undefined}
            onRatingUpdated={onRatingUpdated}
            onImageClick={() => onImageClick(i)}
            onPreview={() => onImageClick(i)}
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
      <div className="shootit-gallery-justified">
        {images.map((image, i) => {
          const width = image.width || 400;
          const height = image.height || 300;
          const aspect = width / height;
          return (
            <div
              key={image.id}
              className="shootit-gallery-item relative group"
              style={{
                flexGrow: aspect * 100,
                flexBasis: `calc(${aspect} * var(--gallery-item-base-width))`,
              }}
            >
              <ImageCard
                image={image}
                projectId={projectId}
                onDelete={onDelete ? () => onDelete(image.id) : undefined}
                onRatingUpdated={onRatingUpdated}
                onImageClick={() => onImageClick(i)}
            onPreview={() => onImageClick(i)}
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
    <div className="shootit-gallery-masonry">
      {images.map((image, index) => (
        <div key={image.id} className="mb-3 break-inside-avoid">
          <ImageCard
            image={image}
            projectId={projectId}
            onDelete={onDelete ? () => onDelete(image.id) : undefined}
            onRatingUpdated={onRatingUpdated}
            onImageClick={() => onImageClick(index)}
            onPreview={() => onImageClick(index)}
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
