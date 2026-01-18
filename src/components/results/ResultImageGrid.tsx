'use client';

import { useI18n } from '@/components/I18nProvider';
import { Download, Trash2, CheckCircle2, Circle, Eye } from 'lucide-react';
import { useState } from 'react';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { ImageCard } from '../selection/ImageCard';

type ResultFile = {
  id: string;
  filename: string;
  path: string;
  thumbnail: string | null;
};

export function ResultImageGrid({
  images,
  selectedIds,
  onToggleSelect,
  onDelete,
  showDelete = true,
  projectId
}: {
  images: ResultFile[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  showDelete?: boolean;
  projectId: string;
}) {
  const [index, setIndex] = useState(-1);

  return (
    <div className="py-4">
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

      <Lightbox
        index={index}
        open={index >= 0}
        close={() => setIndex(-1)}
        slides={images.map(img => ({ 
          src: img.path, 
          downloadUrl: img.path,
          title: img.filename 
        }))}
      />
    </div>
  );
}
