"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  CheckSquare,
  Download,
  Heart,
  MoreHorizontal,
  Play,
  Square,
  Upload,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";
import { LocalMediaPicker } from "../selection/LocalMediaPicker";
import ImageUpload from "./ImageUpload";

import Lightbox from "yet-another-react-lightbox";
import Video from "yet-another-react-lightbox/plugins/video";
import "yet-another-react-lightbox/styles.css";

interface MoodboardImage {
  id: string;
  filename: string;
  path: string;
  thumbnail: string | null;
  order: number;
  width?: number | null;
  height?: number | null;
  isVideo?: boolean;
  duration?: number | null;
}

function videoMimeFor(path: string): string {
  const p = path.split("?")[0].split("#")[0].toLowerCase();
  if (p.endsWith(".webm")) return "video/webm";
  if (p.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Renders a moodboard item as either an image or a hover-playable video.
function MoodboardMedia({
  image,
  className,
  useFullForImage,
}: {
  image: MoodboardImage;
  className: string;
  useFullForImage?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  if (image.isVideo) {
    return (
      <>
        <video
          ref={videoRef}
          src={`${image.path}#t=0.1`}
          poster={image.thumbnail || undefined}
          muted
          loop
          playsInline
          preload="metadata"
          className={className}
          draggable={false}
          onMouseEnter={() => videoRef.current?.play().catch(() => {})}
          onMouseLeave={() => {
            const v = videoRef.current;
            if (v) {
              v.pause();
              v.currentTime = 0;
            }
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity duration-200">
          <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
        {image.duration ? (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-medium px-1.5 py-0.5 rounded pointer-events-none">
            {formatDuration(image.duration)}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <img
      src={useFullForImage ? image.path : image.thumbnail || image.path}
      alt={image.filename}
      className={className}
    />
  );
}

interface Comment {
  id: string;
  content: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  isArchived: boolean;
  isFavorite: boolean;
  isLibrary: boolean;
  order: number;
  status: string;
  images: MoodboardImage[];
  comments: Comment[];
}

interface MoodboardGroupProps {
  group: Group;
  projectId: string;
  galleryLayout?: string;
  hasLocalMedia?: boolean;
  onUpdate?: () => void;
  onDelete?: () => void;
  isInitiallyCollapsed?: boolean;
  showFavorites?: boolean;
}

export function MoodboardGroup({
  group,
  projectId,
  galleryLayout,
  hasLocalMedia,
  onUpdate,
  onDelete,
  showFavorites = false,
}: MoodboardGroupProps) {
  const { data: session } = useSession();
  const { t, locale } = useI18n();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [index, setIndex] = useState(-1);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeletingImages, setIsDeletingImages] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const isOwner = session?.user?.id === group.ownerId;
  const isLinked = projectId !== "";
  const isLibrary = group.isLibrary;

  const handleDelete = async () => {
    const confirmMessage = isLinked
      ? t("moodboard.deleteGroupConfirm").replace("{name}", group.name) // We might want a different text for "Unlink"
      : t("moodboard.deleteGroupConfirm").replace("{name}", group.name);

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    try {
      const url = isLinked
        ? `/api/projects/${projectId}/moodboard/groups/${group.id}`
        : `/api/user/moodboards/${group.id}`;

      const response = await fetch(url, { method: "DELETE" });

      if (response.ok) {
        onDelete?.();
      } else {
        alert(t("moodboard.deleteGroupError"));
      }
    } catch (error) {
      alert(t("common.error"));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFavorite = async () => {
    setIsTogglingFavorite(true);
    try {
      const url = isLinked
        ? `/api/projects/${projectId}/moodboard/groups/${group.id}`
        : `/api/user/moodboards/${group.id}`;

      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !group.isFavorite }),
      });

      if (response.ok) {
        onUpdate?.();
      }
    } catch (error) {
      console.error("Favorite toggle error:", error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleArchive = async () => {
    try {
      const response = await fetch(`/api/user/moodboards/${group.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !group.isArchived }),
      });

      if (response.ok) {
        onUpdate?.();
      }
    } catch (error) {
      alert(t("common.error"));
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!isLinked) return;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/moodboard/groups/${group.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      if (response.ok) {
        onUpdate?.();
      } else {
        alert(t("common.error"));
      }
    } catch (error) {
      alert(t("common.error"));
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsAddingComment(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/moodboard/groups/${group.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newComment }),
        },
      );

      if (response.ok) {
        setNewComment("");
        onUpdate?.();
      } else {
        alert(t("common.error"));
      }
    } catch (error) {
      alert(t("common.error"));
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleDownload = async (
    imageIds: string[] = [],
    groupIds: string[] = [],
  ) => {
    if (imageIds.length === 0 && groupIds.length === 0) return;

    setIsDownloading(true);
    try {
      const response = await fetch("/api/moodboards/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds, groupIds }),
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename =
        groupIds.length > 0
          ? `${group.name}_images.zip`
          : `moodboard_selection.zip`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      alert(t("common.error"));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDeleteImages = async (imageIds: string[]) => {
    const confirmMessage =
      imageIds.length === 1
        ? t("moodboard.deleteImageConfirm")
        : t("moodboard.deleteImagesConfirm").replace(
            "{count}",
            imageIds.length.toString(),
          );

    if (!confirm(confirmMessage)) return;

    setIsDeletingImages(true);
    try {
      const response = await fetch("/api/moodboards/images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds }),
      });

      if (response.ok) {
        setSelectedImageIds([]);
        onUpdate?.();
      } else {
        alert(t("common.error"));
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert(t("common.error"));
    } finally {
      setIsDeletingImages(false);
    }
  };

  const toggleSelectImage = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation();
    setSelectedImageIds((prev) =>
      prev.includes(imageId)
        ? prev.filter((id) => id !== imageId)
        : [...prev, imageId],
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "bg-green-100 text-green-800 border-green-300";
      case "REJECTED":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const uploadUrl = isLinked
    ? `/api/projects/${projectId}/moodboard/groups/${group.id}/images`
    : `/api/user/moodboards/${group.id}/images`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{group.name}</h2>
          <p className="text-xs text-slate-500">
            {group.images.length} {t("selection.images")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOwner && showFavorites && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleFavorite}
              disabled={isTogglingFavorite}
              aria-label={t("common.favorite")}
            >
              <Heart
                className={`h-4 w-4 ${group.isFavorite ? "fill-amber-400 text-amber-500" : ""}`}
              />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={isDownloading || !group.images.length}
            onClick={() =>
              handleDownload(
                selectedImageIds,
                selectedImageIds.length ? [] : [group.id],
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            {selectedImageIds.length
              ? t("moodboard.downloadSelected").replace(
                  "{count}",
                  String(selectedImageIds.length),
                )
              : t("moodboard.downloadAll")}
          </Button>
          {(isOwner || !isLibrary) && (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              {t("design.uploadImages")}
            </Button>
          )}
          {(isOwner || isLinked) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("common.actions")}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isLinked && isOwner && (
                  <DropdownMenuItem onSelect={handleArchive}>
                    {group.isArchived
                      ? t("moodboard.unarchive")
                      : t("moodboard.archive")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onSelect={handleDelete}
                  disabled={isDeleting}
                  className="text-red-600"
                >
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <ImageUpload
          uploadUrl={uploadUrl}
          onSuccess={() => onUpdate?.()}
          disabled={isLibrary && !isOwner}
          className="min-w-0 w-full flex-1"
        >
          {group.images.length ? (
            <div
              className={
                galleryLayout === "grid"
                  ? "grid grid-cols-2 gap-2 2xl:grid-cols-3"
                  : "columns-2 gap-2 2xl:columns-3"
              }
            >
              {group.images.map((image, i) => (
                <div
                  key={image.id}
                  className={`group relative mb-2 break-inside-avoid overflow-hidden rounded-lg ${selectedImageIds.includes(image.id) ? "ring-2 ring-blue-600" : ""}`}
                >
                  <button
                    className="block w-full"
                    onClick={() => setIndex(i)}
                    aria-label={`${t("design.preview")}: ${image.filename}`}
                  >
                    <MoodboardMedia
                      image={image}
                      className={
                        galleryLayout === "grid"
                          ? "aspect-[4/5] w-full object-cover"
                          : "h-auto w-full"
                      }
                    />
                  </button>
                  {isOwner && (
                    <button
                      aria-label={`${t("design.selectImage")}: ${image.filename}`}
                      aria-pressed={selectedImageIds.includes(image.id)}
                      className={`absolute left-2 top-2 rounded p-1 ${selectedImageIds.includes(image.id) ? "bg-blue-600 text-white" : "bg-white/90 text-slate-500"}`}
                      onClick={(e) => toggleSelectImage(e, image.id)}
                    >
                      {selectedImageIds.includes(image.id) ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="studio-panel p-12 text-center text-sm text-slate-500">
              {t("common.noImages")}
            </div>
          )}
        </ImageUpload>
        <aside className="studio-panel w-full shrink-0 p-4 xl:sticky xl:top-20 xl:w-72">
          <div className="mb-4 flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold">{group.name}</h3>
            {isLinked && (
              <span
                className={`shrink-0 rounded px-2 py-1 text-[10px] ${getStatusColor(group.status)}`}
              >
                {t(
                  group.status === "ACCEPTED"
                    ? "design.approved"
                    : group.status === "REJECTED"
                      ? "design.declined"
                      : "design.pending",
                )}
              </span>
            )}
          </div>
          {group.description && (
            <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {group.description}
            </p>
          )}
          {isLinked && (
            <>
              <div className="mb-5 space-y-2">
                <Button
                  className="w-full"
                  disabled={group.status === "ACCEPTED"}
                  onClick={() => handleStatusChange("ACCEPTED")}
                >
                  {t("design.approve")}
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={group.status === "REJECTED"}
                  onClick={() => handleStatusChange("REJECTED")}
                >
                  {t("design.decline")}
                </Button>
              </div>
              <h4 className="border-t pt-4 text-xs font-semibold">
                {t("design.comments")} ({group.comments.length})
              </h4>
              <div className="my-4 max-h-80 space-y-4 overflow-y-auto">
                {group.comments.map((comment) => (
                  <div key={comment.id}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {comment.user.name || comment.user.email}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleDateString(locale)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-500">
                      {comment.content}
                    </p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddComment} className="flex gap-2">
                <Input
                  aria-label={t("design.commentPlaceholder")}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t("design.commentPlaceholder")}
                  disabled={isAddingComment}
                />
                <Button
                  size="sm"
                  type="submit"
                  disabled={isAddingComment || !newComment.trim()}
                >
                  {t("design.sendComment")}
                </Button>
              </form>
            </>
          )}
        </aside>
      </div>
      {selectedImageIds.length > 0 && (
        <div className="sticky bottom-3 flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3">
          <span className="mr-auto text-sm">
            {selectedImageIds.length} {t("selection.selected")}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedImageIds([])}
          >
            {t("selection.deselectAll")}
          </Button>
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteImages(selectedImageIds)}
              disabled={isDeletingImages}
              className="text-red-600"
            >
              {t("common.delete")}
            </Button>
          )}
        </div>
      )}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("design.uploadImages")}</DialogTitle>
            <DialogDescription>{group.name}</DialogDescription>
          </DialogHeader>
          {hasLocalMedia && (
            <LocalMediaPicker
              projectId={projectId}
              importUrl={
                isLinked
                  ? `/api/projects/${projectId}/moodboard/groups/${group.id}/scan`
                  : `/api/user/moodboards/${group.id}/scan`
              }
              onSuccess={() => onUpdate?.()}
            />
          )}
          <ImageUpload uploadUrl={uploadUrl} onSuccess={() => onUpdate?.()} />
        </DialogContent>
      </Dialog>
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
        slides={group.images.map((img) =>
          img.isVideo
            ? {
                type: "video" as const,
                poster: img.thumbnail || undefined,
                width: img.width || undefined,
                height: img.height || undefined,
                sources: [{ src: img.path, type: videoMimeFor(img.path) }],
              }
            : { src: img.path },
        )}
      />
    </div>
  );
}
