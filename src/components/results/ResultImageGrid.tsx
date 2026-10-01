"use client";

import { useI18n } from "@/components/I18nProvider";
import { Eye, Trash2 } from "lucide-react";
import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Video from "yet-another-react-lightbox/plugins/video";
import "yet-another-react-lightbox/styles.css";
import { ImageCard } from "../selection/ImageCard";

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
  onInspect,
  layout = "masonry",
}: {
  images: ResultFile[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
  showDelete?: boolean;
  projectId: string;
  layout?: string;
  onInspect?: (id: string) => void;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(-1);

  if (images.length === 0) return null;

  const renderGridV2 = () => {
    if (layout === "list")
      return (
        <div className="divide-y rounded-lg border bg-white">
          {images.map((image, i) => (
            <div key={image.id} className="flex items-center gap-3 p-3">
              <input
                type="checkbox"
                aria-label={`${t("design.selectImage")}: ${image.filename}`}
                checked={selectedIds.has(image.id)}
                onChange={() => onToggleSelect(image.id)}
              />
              <button
                onClick={() => (onInspect ? onInspect(image.id) : setIndex(i))}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <img
                  src={image.thumbnail || image.path}
                  alt=""
                  className="h-12 w-16 rounded object-cover"
                />
                <span className="truncate text-sm">{image.filename}</span>
              </button>
              <button
                onClick={() => setIndex(i)}
                aria-label={t("design.preview")}
              >
                <Eye className="h-4 w-4" />
              </button>
              {showDelete && (
                <button
                  onClick={() => onDelete(image.id)}
                  aria-label={t("common.delete")}
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      );
    if (layout === "grid") {
      return (
        <div className="grid grid-cols-2 gap-3 2xl:grid-cols-3">
          {images.map((image, i) => (
            <ImageCard
              key={image.id}
              image={{ ...image, ratings: null }}
              projectId={projectId}
              onImageClick={() =>
                onInspect ? onInspect(image.id) : setIndex(i)
              }
              onPreview={() => setIndex(i)}
              onDelete={showDelete ? () => onDelete(image.id) : undefined}
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
                  image={{ ...image, ratings: null }}
                  projectId={projectId}
                  onImageClick={() =>
                    onInspect ? onInspect(image.id) : setIndex(i)
                  }
                  onPreview={() => setIndex(i)}
                  onDelete={showDelete ? () => onDelete(image.id) : undefined}
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

    return (
      <div className="columns-2 gap-3 2xl:columns-3">
        {images.map((image, i) => (
          <div key={image.id} className="mb-3 break-inside-avoid">
            <ImageCard
              image={{ ...image, ratings: null }}
              projectId={projectId}
              onImageClick={() =>
                onInspect ? onInspect(image.id) : setIndex(i)
              }
              onPreview={() => setIndex(i)}
              onDelete={showDelete ? () => onDelete(image.id) : undefined}
              masonry
              selected={selectedIds.has(image.id)}
              onSelect={() => onToggleSelect(image.id)}
              hideRatings
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {renderGridV2()}

      <Lightbox
        labels={{
          Close: t("common.close"),
          Previous: t("design.previousImage"),
          Next: t("design.nextImage"),
        }}
        index={index}
        open={index >= 0}
        close={() => setIndex(-1)}
        plugins={[Video]}
        slides={images.map((img) =>
          img.isVideo
            ? {
                type: "video" as const,
                poster: img.thumbnail || undefined,
                width: img.width || undefined,
                height: img.height || undefined,
                sources: [{ src: img.path, type: videoMimeFor(img.path) }],
                downloadUrl: img.path,
                title: img.filename,
              }
            : {
                src: img.path,
                downloadUrl: img.path,
                title: img.filename,
              },
        )}
      />
    </div>
  );
}
