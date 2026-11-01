"use client";

import { Download, Trash2 } from "lucide-react";
import { imagePreviewSource } from "@/lib/image-preview";
import { useI18n } from "@/components/I18nProvider";
import { RatingControls, type RatingUpdateHandler } from "./RatingControls";

type ListImage = {
  id: string;
  filename: string;
  path: string;
  thumbnail: string | null;
  ratings: { id: string; stars: number | null; color: string | null } | null;
};

export function SelectionImageList({ images, projectId, onPreview, onRatingUpdated, selectedIds, onToggleSelect, onDelete, onDownload, readOnly, isGuest }: {
  images: ListImage[];
  projectId: string;
  onPreview: (index: number) => void;
  onRatingUpdated: RatingUpdateHandler;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDownload?: (image: ListImage) => void;
  readOnly?: boolean;
  isGuest?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="divide-y rounded-lg border bg-white">
      {images.map((image, index) => (
        <div key={image.id} className="flex flex-wrap items-center gap-3 p-3">
          {onToggleSelect && <label className="flex min-h-11 min-w-11 items-center justify-center">
            <input type="checkbox" aria-label={`${t("design.selectImage")}: ${image.filename}`} checked={selectedIds?.has(image.id) ?? false} onChange={() => onToggleSelect(image.id)} />
          </label>}
          <button onClick={() => onPreview(index)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <img src={imagePreviewSource(image)} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded object-contain" />
            <span className="truncate text-sm">{image.filename}</span>
          </button>
          <RatingControls projectId={projectId} imageId={image.id} initialRating={image.ratings || undefined} onRatingUpdated={onRatingUpdated} disabled={readOnly} isGuest={isGuest} />
          {onDownload && <button onClick={() => onDownload(image)} aria-label={`${t("common.download")}: ${image.filename}`} className="flex h-11 w-11 items-center justify-center"><Download className="h-4 w-4" /></button>}
          {onDelete && <button onClick={() => onDelete(image.id)} aria-label={`${t("common.delete")}: ${image.filename}`} className="flex h-11 w-11 items-center justify-center text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
        </div>
      ))}
    </div>
  );
}
