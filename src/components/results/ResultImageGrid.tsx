'use client';

import { useI18n } from '@/components/I18nProvider';
import { Download, Trash2, CheckCircle2, Circle, Eye } from 'lucide-react';
import { useState } from 'react';
import Lightbox from "yet-another-react-lightbox";
import Video from "yet-another-react-lightbox/plugins/video";
import "yet-another-react-lightbox/styles.css";
import { ImageCard } from '../selection/ImageCard';

type ResultFile = {
  id: string;
  filename: string;
  path: string;
  thumbnail: string | null;
  width?: number | null;
  height?: number | null;
  isVideo?: boolean;
  duration?: number | null;
};

function videoMimeFor(path: string): string {
  const ext = path.split("?")[0].split("#")[0].toLowerCase();
  if (ext.endsWith(".webm")) return "video/webm";
  if (ext.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

export function ResultImageGrid({
  images,
  selectedIds,
  onToggleSelect,
  onDelete,
  showDelete = true,
  projectId,
  layout = "masonry"
}: {
  images: ResultFile[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  showDelete?: boolean;
  projectId: string;
  layout?: string;
}) {
  const [index, setIndex] = useState(-1);

  if (images.length === 0) return null;

  const renderGridV2 = () => {
    if (layout === "grid") {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {images.map((image, i) => (
            <ImageCard
              key={image.id}
              image={{...image, ratings: null}}
              projectId={projectId}
              onImageClick={() => setIndex(i)}
              selected={selectedIds.has(image.id)}
              onSelect={() => onToggleSelect(image.id)}
              hideRatings={true}
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
                className="relative group h-[240px]"
                style={{
                  flexGrow: aspect * 100,
                  flexBasis: `${aspect * 240}px`,
                }}
              >
                <ImageCard
                  image={{...image, ratings: null}}
                  projectId={projectId}
                  onImageClick={() => setIndex(i)}
                  justified={true}
                  selected={selectedIds.has(image.id)}
                  onSelect={() => onToggleSelect(image.id)}
                  hideRatings={true}
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
               image={{...image, ratings: null}}
               projectId={projectId}
               onImageClick={() => setIndex(i)}
               masonry={true}
               selected={selectedIds.has(image.id)}
               onSelect={() => onToggleSelect(image.id)}
               hideRatings={true}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="py-4">
      {renderGridV2()}

      <Lightbox
        index={index}
        open={index >= 0}
        close={() => setIndex(-1)}
        plugins={[Video]}
        slides={images.map(img => img.isVideo ? ({
          type: "video" as const,
          poster: img.thumbnail || undefined,
          width: img.width || undefined,
          height: img.height || undefined,
          sources: [{ src: img.path, type: videoMimeFor(img.path) }],
          downloadUrl: img.path,
          title: img.filename,
        }) : ({
          src: img.path,
          downloadUrl: img.path,
          title: img.filename,
        }))}
      />
    </div>
  );
}
