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
import {
  CheckSquare,
  Columns,
  FolderPlus,
  LayoutGrid,
  Move,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import ImageUpload from "../moodboard/ImageUpload";
import { ExportDialog } from "./ExportDialog";
import { FilterBar } from "./FilterBar";
import { LocalMediaPicker } from "./LocalMediaPicker";
import { RatingControls } from "./RatingControls";
import { SelectionFolderForm } from "./SelectionFolderForm";
import { SelectionFolderTree } from "./SelectionFolderTree";
import { SelectionImageGrid } from "./SelectionImageGrid";

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
  width?: number | null;
  height?: number | null;
  ratings: Rating | null;
  folderId?: string | null;
}

interface SelectionFolder {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  images: SelectionImage[];
  children?: SelectionFolder[];
}

interface SelectionContentProps {
  projectId: string;
  initialImages: SelectionImage[];
  initialFolders: SelectionFolder[];
  userId: string;
  galleryLayout?: string;
  hasLocalMedia?: boolean;
  showFolders?: boolean;
}

export function SelectionContent({
  projectId,
  initialImages,
  initialFolders,
  galleryLayout = "grid",
  hasLocalMedia,
  showFolders = true,
}: SelectionContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [view, setView] = useState<"grid" | "masonry" | "justified">(
    galleryLayout === "masonry" || galleryLayout === "justified"
      ? galleryLayout
      : "grid",
  );
  const [unrated, setUnrated] = useState(false);
  const [index, setIndex] = useState(-1);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(
    new Set(),
  );
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState<SelectionFolder | null>(
    null,
  );

  const filteredImages = useMemo(() => {
    return initialImages.filter(
      (img) =>
        (selectedFolderId === "unassigned"
          ? !img.folderId
          : !selectedFolderId || img.folderId === selectedFolderId) &&
        (!unrated || (!img.ratings?.stars && !img.ratings?.color)),
    );
  }, [initialImages, selectedFolderId, unrated]);

  const handleRatingUpdated = () => {
    router.refresh();
  };

  const handleToggleSelectAll = () => {
    if (
      filteredImages.length > 0 &&
      filteredImages.every((img) => selectedImageIds.has(img.id))
    ) {
      setSelectedImageIds(new Set());
    } else {
      setSelectedImageIds(new Set(filteredImages.map((img) => img.id)));
    }
  };

  const handleToggleImage = (ids: string | string[]) => {
    const newSelected = new Set(selectedImageIds);
    const idArray = Array.isArray(ids) ? ids : [ids];

    idArray.forEach((id) => {
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
    });

    setSelectedImageIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (!selectedImageIds.size || !confirm(t("selection.confirmDeleteImages")))
      return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/selection/images/bulk`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageIds: Array.from(selectedImageIds) }),
        },
      );

      if (!res.ok) throw new Error();

      toast.success(t("selection.deletedSuccess"));
      setSelectedImageIds(new Set());
      router.refresh();
    } catch (error) {
      toast.error(t("common.error"));
    }
  };

  const handleMoveSelected = async (
    targetFolderId: string | null,
    imageIds = Array.from(selectedImageIds),
  ) => {
    if (!imageIds.length) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/selection/images/bulk`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageIds,
            folderId: targetFolderId,
          }),
        },
      );

      if (!res.ok) throw new Error();

      toast.success(t("selection.movedSuccess"));
      setSelectedImageIds(new Set());
      router.refresh();
    } catch (error) {
      toast.error(t("common.error"));
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm(t("selection.confirmDeleteFolder"))) return;

    try {
      const res = await fetch(
        `/api/projects/${projectId}/selection/folders?folderId=${folderId}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) throw new Error();

      toast.success(t("selection.folderDeleted"));
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      router.refresh();
    } catch (error) {
      toast.error(t("common.error"));
    }
  };

  const handleFilterChange = (filterType: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === null) {
      params.delete(filterType);
    } else {
      const currentValues = params.getAll(filterType);
      if (currentValues.includes(value)) {
        const newValues = currentValues.filter((v) => v !== value);
        params.delete(filterType);
        newValues.forEach((v) => params.append(filterType, v));
      } else {
        params.append(filterType, value);
      }
    }

    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="studio-page-title">{t("selection.title")}</h2>
          <p className="studio-page-subtitle">
            {initialImages.length} {t("selection.images")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            {t("selection.importImages")}
          </Button>
          <ExportDialog
            images={
              selectedImageIds.size
                ? initialImages.filter((img) => selectedImageIds.has(img.id))
                : filteredImages
            }
          />
          {showFolders && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingFolder(null);
                setShowFolderForm(true);
              }}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              {t("selection.newFolder")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-[600px] flex-col gap-5 md:flex-row">
        {showFolders && (
          <aside className="w-full md:w-44 flex-shrink-0">
            <div className="sticky top-24">
              <div className="px-2 pb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">
                  {t("selection.folders")}
                </h3>
              </div>
              <div>
                <button
                  onClick={() => {
                    setSelectedFolderId(null);
                    setSelectedImageIds(new Set());
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    selectedFolderId === null
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div className="w-4 h-4" />
                  {t("selection.allImages")}
                </button>

                <button
                  onClick={() => {
                    setSelectedFolderId("unassigned");
                    setSelectedImageIds(new Set());
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    selectedFolderId === "unassigned"
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div className="w-4 h-4" />
                  {t("selection.unassigned")}
                </button>

                <SelectionFolderTree
                  folders={initialFolders}
                  selectedFolderId={selectedFolderId}
                  onSelectFolder={(id) => {
                    setSelectedFolderId(id);
                    setSelectedImageIds(new Set());
                  }}
                  onDeleteFolder={handleDeleteFolder}
                  onEditFolder={(folder) => {
                    setEditingFolder(folder);
                    setShowFolderForm(true);
                  }}
                  onMoveImages={async (imageIds, targetFolderId) => {
                    await handleMoveSelected(targetFolderId, imageIds);
                  }}
                />
              </div>
            </div>
          </aside>
        )}

        <section className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={unrated ? "ghost" : "secondary"}
                onClick={() => setUnrated(false)}
              >
                {t("design.all")}
              </Button>
              <Button
                size="sm"
                variant={unrated ? "secondary" : "ghost"}
                onClick={() => setUnrated(true)}
              >
                {t("design.noRating")}
              </Button>
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant={view === "grid" ? "secondary" : "ghost"}
                onClick={() => setView("grid")}
                aria-label={t("design.gridView")}
                aria-pressed={view === "grid"}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={view === "masonry" ? "secondary" : "ghost"}
                onClick={() => setView("masonry")}
                aria-label={t("design.masonry")}
                aria-pressed={view === "masonry"}
              >
                <Columns className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <FilterBar
            onFilterChange={handleFilterChange}
            activeStars={searchParams.getAll("stars")}
            activeColors={searchParams.getAll("color")}
          />
          {filteredImages.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500 text-lg">{t("common.noImages")}</p>
              <p className="text-sm text-gray-400 mt-2">
                {t("common.uploadPrompt")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleSelectAll}
                  className="text-gray-500 hover:text-gray-700"
                >
                  {filteredImages.length > 0 &&
                  filteredImages.every((img) =>
                    selectedImageIds.has(img.id),
                  ) ? (
                    <CheckSquare className="h-4 w-4 mr-2" />
                  ) : (
                    <Square className="h-4 w-4 mr-2" />
                  )}
                  {filteredImages.length > 0 &&
                  filteredImages.every((img) => selectedImageIds.has(img.id))
                    ? t("selection.deselectAll")
                    : t("selection.selectAll")}
                </Button>
                <p className="text-sm text-gray-500">
                  {filteredImages.length} {t("selection.images")}
                </p>
              </div>

              <SelectionImageGrid
                images={filteredImages}
                projectId={projectId}
                layout={view}
                selectedIds={selectedImageIds}
                onToggleSelect={handleToggleImage}
                onImageClick={(i) => setIndex(i)}
                onRatingUpdated={handleRatingUpdated}
              />
            </div>
          )}

          <div className="sticky bottom-3 z-10">
            {" "}
            {selectedImageIds.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-sm font-medium text-blue-700">
                  {selectedImageIds.size} {t("selection.selected")}
                </span>
                <div className="h-4 w-px bg-blue-200 mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("common.delete")}
                  className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                {showFolders && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t("selection.moveTo")}
                        className="h-8 text-blue-600"
                      >
                        <Move className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleMoveSelected(null)}
                      >
                        {t("selection.moveToRoot")}
                      </DropdownMenuItem>
                      {initialFolders.map((folder) => (
                        <DropdownMenuItem
                          key={folder.id}
                          onClick={() => handleMoveSelected(folder.id)}
                        >
                          {t("selection.moveTo")} {folder.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t("selection.deselectAll")}
                  className="h-8 text-gray-500"
                  onClick={() => setSelectedImageIds(new Set())}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("selection.importImages")}</DialogTitle>
            <DialogDescription>
              {initialFolders.find((folder) => folder.id === selectedFolderId)
                ?.name || t("selection.unassigned")}
            </DialogDescription>
          </DialogHeader>
          {hasLocalMedia && (
            <LocalMediaPicker
              projectId={projectId}
              onSuccess={() => router.refresh()}
              importUrl={`/api/projects/${projectId}/selection/scan`}
            />
          )}
          <ImageUpload
            uploadUrl={`/api/projects/${projectId}/selection/images`}
            onSuccess={() => router.refresh()}
            folderId={
              selectedFolderId && selectedFolderId !== "unassigned"
                ? selectedFolderId
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
      <SelectionFolderForm
        isOpen={showFolderForm}
        onClose={() => {
          setShowFolderForm(false);
          setEditingFolder(null);
        }}
        projectId={projectId}
        folder={editingFolder || undefined}
        onSuccess={() => {
          setShowFolderForm(false);
          setEditingFolder(null);
          router.refresh();
        }}
      />

      <Lightbox
        labels={{
          Close: t("common.close"),
          Previous: t("design.previousImage"),
          Next: t("design.nextImage"),
        }}
        index={index}
        open={index >= 0}
        close={() => setIndex(-1)}
        slides={filteredImages.map((img) => ({
          src: img.path,
          image: img,
        }))}
        render={{
          slide: ({ slide }: any) => (
            <div className="flex flex-col items-center justify-center w-full h-full p-4 md:p-12 overflow-hidden">
              <div className="flex-1 w-full flex items-center justify-center min-h-0">
                <img
                  src={slide.src}
                  alt=""
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
              </div>
              <div
                className="mt-8 shrink-0 pb-4"
                onClick={(e) => e.stopPropagation()}
              >
                <RatingControls
                  projectId={projectId}
                  imageId={slide.image.id}
                  initialRating={slide.image.ratings}
                  onRatingUpdated={handleRatingUpdated}
                />
              </div>
            </div>
          ),
        }}
      />
    </div>
  );
}
