"use client";

import { useI18n } from "@/components/I18nProvider";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  Download,
  Eye,
  MoreHorizontal,
  Play,
  Trash2,
} from "lucide-react";
import { useRef } from "react";
import { RatingControls } from "./RatingControls";

interface Rating {
  id: string;
  stars: number | null;
  color: string | null;
}

interface SelectionImage {
  id: string;
  filename: string;
  path: string;
  thumbnail: string | null;
  ratings: Rating | null;
  isVideo?: boolean;
  duration?: number | null;
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface ImageCardProps {
  image: SelectionImage;
  projectId: string;
  onRatingUpdated?: () => void;
  onImageClick?: () => void;
  masonry?: boolean;
  justified?: boolean;
  readOnly?: boolean;
  isGuest?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  hideRatings?: boolean;
  onDownload?: () => void;
  forceSelectable?: boolean;
  onDelete?: () => void;
  onPreview?: () => void;
}

export function ImageCard({
  image,
  projectId,
  onRatingUpdated,
  onImageClick,
  masonry,
  justified,
  readOnly,
  isGuest,
  selected,
  onSelect,
  hideRatings,
  onDownload,
  forceSelectable,
  onDelete,
  onPreview,
}: ImageCardProps) {
  const { t } = useI18n();
  const currentRating = image.ratings;
  const color = currentRating?.color || null;
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    const v = videoRef.current;
    if (v) {
      v.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  };

  return (
    <Card
      draggable={!readOnly && !isGuest}
      onDragStart={(e) => {
        if (!readOnly && !isGuest) {
          e.dataTransfer.setData(
            "application/json",
            JSON.stringify({ imageId: image.id }),
          );
          e.dataTransfer.effectAllowed = "move";
        }
      }}
      className={`overflow-hidden relative group transition-all duration-200 ${selected ? "ring-2 ring-blue-500 shadow-md" : ""}  ${justified ? "h-full flex flex-col" : ""}`}
    >
      {/* Selection Checkbox */}
      {((!readOnly && !isGuest) || forceSelectable) && onSelect && (
        <button
          type="button"
          aria-label={`${t("design.selectImage")}: ${image.filename}`}
          aria-pressed={!!selected}
          className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-md border-2 border-white/50 backdrop-blur-md flex items-center justify-center cursor-pointer transition-all ${selected ? "bg-blue-500 border-blue-500 opacity-100" : "bg-white/80 text-slate-600 hover:bg-white"}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
        >
          {selected && <Check className="w-4 h-4 text-white" />}
        </button>
      )}

      {(onDelete || onPreview) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`${t("design.imageActions")}: ${image.filename}`}
              className="absolute right-2 top-2 z-20 rounded-full bg-white p-1.5 text-slate-600 shadow-sm"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onPreview && (
              <DropdownMenuItem onSelect={onPreview}>
                <Eye className="mr-2 h-4 w-4" />
                {t("design.preview")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <a href={image.path} download={image.filename}>
                <Download className="mr-2 h-4 w-4" />
                {t("selection.download")}
              </a>
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem onSelect={onDelete} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                {t("common.delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {/* Download button */}
      {onDownload && (
        <button
          className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          title={image.filename}
        >
          <Download className="w-4 h-4" />
        </button>
      )}

      {/* Media */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`${t("design.preview")}: ${image.filename}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onImageClick?.();
          }
        }}
        className={`${justified ? "h-[240px]" : masonry ? "" : "aspect-[4/3]"} bg-gray-100 relative overflow-hidden cursor-zoom-in group flex-shrink-0`}
        onClick={onImageClick}
        onMouseEnter={image.isVideo ? handleMouseEnter : undefined}
        onMouseLeave={image.isVideo ? handleMouseLeave : undefined}
      >
        {image.isVideo ? (
          <>
            <video
              ref={videoRef}
              src={`${image.path}#t=0.1`}
              poster={image.thumbnail || undefined}
              muted
              loop
              playsInline
              preload="none"
              className={`w-full ${justified || !masonry ? "h-full object-cover" : "h-auto"}`}
              draggable={false}
            />
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity duration-200">
              <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
                <Play className="w-6 h-6 text-white fill-white" />
              </div>
            </div>
            {/* Duration badge */}
            {image.duration ? (
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-medium px-1.5 py-0.5 rounded pointer-events-none">
                {formatDuration(image.duration)}
              </div>
            ) : null}
          </>
        ) : image.thumbnail || image.path ? (
          <img
            src={image.thumbnail || image.path}
            alt={image.filename}
            loading="lazy"
            decoding="async"
            className={`w-full ${justified || !masonry ? "h-full object-cover" : "h-auto"} group-hover:scale-105 transition-transform duration-300`}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs p-2 text-center break-all">
            {image.filename}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-2 pt-2">
        <p
          className="min-w-0 flex-1 truncate text-xs text-slate-700"
          title={image.filename}
        >
          {image.filename}
        </p>
        {color && (
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${color === "GREEN" ? "bg-green-500" : color === "RED" ? "bg-red-500" : "bg-yellow-400"}`}
          />
        )}
      </div>
      {hideRatings && <div className="pb-2" />}
      {/* Rating controls */}
      {!hideRatings && (
        <div className="px-2 pb-2 pt-1">
          <RatingControls
            projectId={projectId}
            imageId={image.id}
            initialRating={currentRating || undefined}
            onRatingUpdated={onRatingUpdated}
            disabled={readOnly}
            isGuest={isGuest}
          />
        </div>
      )}
    </Card>
  );
}
