"use client";

import { useI18n } from "@/components/I18nProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Images, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GroupForm } from "./GroupForm";
import { MoodboardGroup } from "./MoodboardGroup";

interface MoodboardImage {
  id: string;
  filename: string;
  path: string;
  thumbnail: string | null;
  order: number;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  isArchived: boolean;
  isFavorite: boolean;
  isLibrary: boolean;
  createdAt: Date;
  images: MoodboardImage[];
  _count?: {
    projectLinks: number;
  };
}

interface MoodboardCollectionProps {
  initialGroups: Group[];
  showFavorites?: boolean;
}

export function MoodboardCollection({
  initialGroups,
  showFavorites = true,
}: MoodboardCollectionProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [currentTab, setCurrentTab] = useState<
    "active" | "archived" | "favorites"
  >("active");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "alphabetical" | "favorites"
  >("favorites");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedGroup = initialGroups.find((group) => group.id === selectedId);

  const filteredAndSortedGroups = useMemo(() => {
    // 1. Filter by Tab and Search
    let result = initialGroups.filter((g) => {
      const matchesSearch =
        !search ||
        g.name.toLowerCase().includes(search.toLowerCase()) ||
        g.description?.toLowerCase().includes(search.toLowerCase());
      const matchesTab =
        currentTab === "archived"
          ? g.isArchived
          : !g.isArchived && (currentTab !== "favorites" || g.isFavorite);
      return matchesSearch && matchesTab;
    });

    // 2. Sort
    result.sort((a, b) => {
      if (sortBy === "favorites") {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (sortBy === "newest")
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      if (sortBy === "oldest")
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      if (sortBy === "alphabetical") return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [initialGroups, search, currentTab, sortBy]);

  const handleUpdated = () => {
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex gap-1">
          {(["active", "favorites", "archived"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setCurrentTab(tab)}
              className={`border-b-2 px-3 py-2 text-sm ${currentTab === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}
            >
              {t(
                tab === "active"
                  ? "design.all"
                  : tab === "favorites"
                    ? "common.favorite"
                    : "common.archived",
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("moodboard.searchPlaceholder")}
            placeholder={t("moodboard.searchPlaceholder")}
            className="w-60"
          />
          <select
            aria-label={t("moodboard.sortBy")}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-10 rounded-md border px-2 text-xs"
          >
            {(["favorites", "newest", "oldest", "alphabetical"] as const).map(
              (sort) => (
                <option key={sort} value={sort}>
                  {t(`common.sort${sort[0].toUpperCase()}${sort.slice(1)}`)}
                </option>
              ),
            )}
          </select>
          <GroupForm onSuccess={handleUpdated} />
        </div>
      </div>
      {filteredAndSortedGroups.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAndSortedGroups.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedId(group.id)}
              className="studio-panel overflow-hidden text-left transition-colors hover:border-blue-500"
            >
              <div className="flex aspect-[16/8] gap-1 overflow-hidden bg-slate-100">
                {group.images.length ? (
                  group.images
                    .slice(0, 3)
                    .map((image) => (
                      <img
                        key={image.id}
                        src={image.thumbnail || image.path}
                        alt=""
                        className="min-w-0 flex-1 object-cover"
                      />
                    ))
                ) : (
                  <div className="flex w-full items-center justify-center text-slate-400">
                    <Images className="h-9 w-9" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-semibold">
                    {group.name}
                  </h2>
                  {group.isFavorite && (
                    <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" />
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {group.images.length} {t("selection.images")} ·{" "}
                  {group._count?.projectLinks || 0} {t("nav.projects")}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="studio-panel p-12 text-center text-sm text-slate-500">
          {t("common.noResults")}
        </div>
      )}
      <Dialog
        open={!!selectedGroup}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              {t("moodboard.collectionDescription")}
            </DialogDescription>
          </DialogHeader>
          {selectedGroup && (
            <MoodboardGroup
              group={{
                ...selectedGroup,
                order: 0,
                status: "PENDING",
                comments: [],
              }}
              projectId=""
              onUpdate={handleUpdated}
              onDelete={() => {
                setSelectedId(null);
                handleUpdated();
              }}
              showFavorites={showFavorites}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
