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
import { appConfig } from "@/config/app.config";
import {
  directDownloadViaManifest,
  supportsDirectDownload,
} from "@/lib/direct-download";
import {
  CheckSquare,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  FolderPlus,
  LayoutGrid,
  List,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import ImageUpload from "../moodboard/ImageUpload";
import { FolderForm } from "./FolderForm";
import { FolderTree } from "./FolderTree";
import { ResultImageGrid } from "./ResultImageGrid";

type ResultFile = {
  id: string;
  filename: string;
  path: string;
  thumbnail: string | null;
  folderId: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  createdAt?: Date | string;
  isVideo?: boolean;
  duration?: number | null;
};
type ResultFolder = {
  id: string;
  name: string;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  _count: { images: number };
  images: ResultFile[];
};

export function ResultsContent({
  projectId,
  initialFolders: folders,
  rootImages = [],
  layout = "grid",
}: {
  projectId: string;
  initialFolders: ResultFolder[];
  rootImages?: ResultFile[];
  layout?: string;
}) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [isFolderFormOpen, setIsFolderFormOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(
    new Set(),
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const [view, setView] = useState(
    layout === "justified" ? "justified" : "grid",
  );
  const [sort, setSort] = useState("newest");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMode, setDownloadMode] = useState<"zip" | "files">("zip");
  const allImages = useMemo(
    () => [...rootImages, ...folders.flatMap((folder) => folder.images)],
    [rootImages, folders],
  );
  const filteredImages = useMemo(() => {
    const items =
      selectedFolderId === null
        ? [...allImages]
        : allImages.filter((img) =>
            selectedFolderId === "unassigned"
              ? !img.folderId
              : img.folderId === selectedFolderId,
          );
    return items.sort((a, b) =>
      sort === "name"
        ? a.filename.localeCompare(b.filename, locale)
        : new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
    );
  }, [allImages, selectedFolderId, sort, locale]);
  const detail = filteredImages.find((img) => img.id === detailId);
  const currentFolder = folders.find(
    (folder) => folder.id === selectedFolderId,
  );
  const childFolders = folders.filter(
    (folder) => folder.parentId === (currentFolder?.id ?? null),
  );
  const breadcrumbs: ResultFolder[] = [];
  let ancestor = currentFolder;
  while (
    ancestor &&
    !breadcrumbs.some((folder) => folder.id === ancestor!.id)
  ) {
    breadcrumbs.unshift(ancestor);
    ancestor = folders.find((folder) => folder.id === ancestor?.parentId);
  }
  const selectFolder = (id: string | null) => {
    setSelectedFolderId(id);
    setSelectedImageIds(new Set());
    setDetailId(null);
  };
  const toggleImage = (id: string) => {
    setDetailId(id);
    setSelectedImageIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allSelected =
    filteredImages.length > 0 &&
    filteredImages.every((image) => selectedImageIds.has(image.id));
  const handleDownload = async (mode: "zip" | "files" = downloadMode) => {
    const ids = selectedImageIds.size
      ? [...selectedImageIds].filter((id) =>
          allImages.some((img) => img.id === id),
        )
      : filteredImages.map((img) => img.id);
    if (!ids.length) return;
    setIsDownloading(true);
    const endpoint = `/api/projects/${projectId}/results/download`;
    const body = { imageIds: ids, folderIds: [] };
    try {
      if (mode === "files" && supportsDirectDownload()) {
        await directDownloadViaManifest(endpoint, body);
        return;
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `results_${projectId}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setIsDownloading(false);
    }
  };
  const deleteImage = async (id: string) => {
    if (!confirm(t("common.deleteConfirm"))) return;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/results/images/${id}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error();
      setDetailId(null);
      setSelectedImageIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    }
  };
  const uploadUrl = currentFolder
    ? `/api/projects/${projectId}/results/folders/${currentFolder.id}/images`
    : `/api/projects/${projectId}/results/images`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="studio-page-title">{t("results.title")}</h1>
          <p className="studio-page-subtitle">{t("results.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => setIsFolderFormOpen(true)}
            className="gap-2"
          >
            <FolderPlus className="h-4 w-4" />
            {t("results.newFolder")}
          </Button>
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            {t("design.uploadImages")}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownload("zip")}
            disabled={isDownloading || !filteredImages.length}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? t("common.loading") : t("design.downloadZip")}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-5 md:flex-row">
        <aside className="w-full shrink-0 md:w-44 xl:w-48">
          <h2 className="mb-3 px-2 text-sm font-semibold">
            {t("selection.folders")}
          </h2>
          {[
            [null, t("selection.allImages"), allImages.length],
            ["unassigned", t("selection.unassigned"), rootImages.length],
          ].map(([id, title, count]) => (
            <button
              key={String(id)}
              onClick={() => selectFolder(id as string | null)}
              className={`mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${selectedFolderId === id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">{title}</span>
              <span className="ml-auto text-xs">{count}</span>
            </button>
          ))}
          <FolderTree
            folders={folders}
            projectId={projectId}
            onDelete={() => router.refresh()}
            selectedFolderId={selectedFolderId}
            onSelectFolder={selectFolder}
          />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <nav
              className="flex min-w-0 flex-wrap items-center gap-1 text-xs"
              aria-label={t("selection.folders")}
            >
              <button
                onClick={() => selectFolder(null)}
                className="text-slate-500 hover:text-blue-600"
              >
                {t("results.title")}
              </button>
              {breadcrumbs.map((folder) => (
                <span key={folder.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-slate-400" />
                  <button
                    onClick={() => selectFolder(folder.id)}
                    className="font-medium hover:text-blue-600"
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
              {selectedFolderId === "unassigned" && (
                <span> / {t("selection.unassigned")}</span>
              )}
            </nav>
            <div className="flex items-center gap-2">
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setView("grid")}
                aria-label={t("design.gridView")}
                aria-pressed={view === "grid"}
                className="h-8 w-8"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setView("list")}
                aria-label={t("design.listView")}
                aria-pressed={view === "list"}
                className="h-8 w-8"
              >
                <List className="h-4 w-4" />
              </Button>
              <select
                aria-label={t("common.sortNewest")}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-8 rounded-md border px-2 text-xs"
              >
                <option value="newest">{t("common.sortNewest")}</option>
                <option value="name">{t("common.sortAlphabetical")}</option>
              </select>
            </div>
          </div>
          {selectedFolderId !== "unassigned" && childFolders.length > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-2 xl:grid-cols-3">
              {childFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => selectFolder(folder.id)}
                  className="flex min-w-0 items-center gap-3 rounded-lg border bg-white p-3 text-left hover:border-blue-500 hover:bg-blue-50"
                >
                  <Folder className="h-7 w-7 shrink-0 fill-blue-100 text-blue-600" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {folder.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {folder._count.images} {t("selection.images")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-5 xl:flex-row">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                <button
                  onClick={() =>
                    setSelectedImageIds(
                      allSelected
                        ? new Set()
                        : new Set(filteredImages.map((img) => img.id)),
                    )
                  }
                  className="flex items-center gap-2"
                  disabled={!filteredImages.length}
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {allSelected
                    ? t("results.deselectAll")
                    : t("results.selectAll")}
                </button>
                <span>
                  {filteredImages.length} {t("selection.images")}
                </span>
              </div>
              {filteredImages.length ? (
                <ResultImageGrid
                  images={filteredImages}
                  selectedIds={selectedImageIds}
                  onToggleSelect={toggleImage}
                  onInspect={setDetailId}
                  onDelete={deleteImage}
                  projectId={projectId}
                  layout={view}
                />
              ) : (
                <div className="studio-panel flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center">
                  <FolderOpen className="h-9 w-9 text-slate-300" />
                  <p className="text-sm text-slate-500">
                    {t("common.noImages")}
                  </p>
                  <Button variant="outline" onClick={() => setUploadOpen(true)}>
                    {t("design.uploadImages")}
                  </Button>
                </div>
              )}
            </div>
            {detail && (
              <aside className="studio-panel h-fit w-full shrink-0 p-4 xl:sticky xl:top-20 xl:w-56">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    {t("design.fileDetails")}
                  </h2>
                  <button
                    onClick={() => setDetailId(null)}
                    aria-label={t("common.close")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {detail.isVideo ? (
                  <video
                    src={detail.path}
                    poster={detail.thumbnail || undefined}
                    controls
                    className="mb-3 w-full rounded-md"
                  />
                ) : (
                  <img
                    src={detail.thumbnail || detail.path}
                    alt={detail.filename}
                    className="mb-3 aspect-[4/3] w-full rounded-md object-cover"
                  />
                )}
                <p className="break-words text-sm font-semibold">
                  {detail.filename}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {detail.filename.split(".").pop()?.toUpperCase()}
                  {detail.width && detail.height
                    ? ` · ${detail.width} × ${detail.height} px`
                    : ""}
                  {detail.size
                    ? ` · ${(detail.size / 1024 / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`
                    : ""}
                </p>
                <Button asChild className="my-4 w-full gap-2">
                  <a href={detail.path} download={detail.filename}>
                    <Download className="h-4 w-4" />
                    {t("selection.download")}
                  </a>
                </Button>
                <dl className="space-y-3 text-xs">
                  <div>
                    <dt className="text-slate-500">{t("design.inFolder")}</dt>
                    <dd className="mt-1">
                      {folders.find((folder) => folder.id === detail.folderId)
                        ?.name || t("results.rootLevel")}
                    </dd>
                  </div>
                  {detail.createdAt && (
                    <div>
                      <dt className="text-slate-500">{t("design.uploaded")}</dt>
                      <dd className="mt-1">
                        {new Date(detail.createdAt).toLocaleString(locale)}
                      </dd>
                    </div>
                  )}
                </dl>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 gap-2 text-red-600"
                  onClick={() => deleteImage(detail.id)}
                >
                  <Trash2 className="h-3 w-3" />
                  {t("common.delete")}
                </Button>
              </aside>
            )}
          </div>
          {selectedImageIds.size > 0 && (
            <div className="sticky bottom-3 mt-5 flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
              <span className="mr-auto text-sm font-medium">
                {selectedImageIds.size} {t("selection.selected")}
              </span>
              {supportsDirectDownload() && (
                <select
                  aria-label={t("results.downloadSelected")}
                  value={downloadMode}
                  onChange={(e) =>
                    setDownloadMode(e.target.value as "zip" | "files")
                  }
                  className="rounded border p-2 text-xs"
                >
                  <option value="zip">{t("selection.downloadAsZip")}</option>
                  <option value="files">
                    {t("selection.downloadAsFiles")}
                  </option>
                </select>
              )}
              <Button
                size="sm"
                onClick={() => handleDownload()}
                disabled={isDownloading}
              >
                {t("selection.download")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedImageIds(new Set())}
              >
                {t("results.deselectAll")}
              </Button>
            </div>
          )}
        </div>
      </div>
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("design.uploadImages")}</DialogTitle>
            <DialogDescription>
              {currentFolder?.name || t("results.rootLevel")}
            </DialogDescription>
          </DialogHeader>
          <ImageUpload
            uploadUrl={uploadUrl}
            onSuccess={() => router.refresh()}
            maxSize={appConfig.limits.maxResultsUploadSize}
            enableFolderUpload
          />
        </DialogContent>
      </Dialog>
      <FolderForm
        defaultParentId={currentFolder?.id}
        projectId={projectId}
        folders={folders}
        isOpen={isFolderFormOpen}
        onClose={() => setIsFolderFormOpen(false)}
        onSuccess={() => {
          setIsFolderFormOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
