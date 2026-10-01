"use client";

import { useI18n } from "@/components/I18nProvider";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GroupForm } from "./GroupForm";
import { MoodboardGroup } from "./MoodboardGroup";
import { MoodboardPicker } from "./MoodboardPicker";

interface MoodboardImage {
  id: string;
  filename: string;
  path: string;
  thumbnail: string | null;
  order: number;
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
  createdAt: Date;
  images: MoodboardImage[];
  comments: Comment[];
}

interface MoodboardContentProps {
  projectId: string;
  initialGroups: Group[];
  galleryLayout?: string;
  hasLocalMedia?: boolean;
  showFavorites?: boolean;
}

export function MoodboardContent({
  projectId,
  initialGroups: groups,
  galleryLayout,
  hasLocalMedia,
  showFavorites = false,
}: MoodboardContentProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "alphabetical" | "favorites"
  >("favorites");

  const handleRefresh = () => {
    router.refresh();
  };

  const filteredAndSortedGroups = useMemo(() => {
    let result = [...groups];

    // Filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (g) =>
          g.name.toLowerCase().includes(query) ||
          g.description?.toLowerCase().includes(query),
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "favorites") {
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        // If both are same regarding favorite, fallback to newest
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
  }, [groups, searchQuery, sortBy]);
  const selectedGroup =
    filteredAndSortedGroups.find((group) => group.id === activeGroup) ||
    filteredAndSortedGroups[0];

  return (
    <>
      <div className="mb-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="studio-page-title">
            {t("moodboard.title")} ({groups.length})
          </h2>
          <div className="flex gap-2">
            <MoodboardPicker projectId={projectId} onLink={handleRefresh} />
            <GroupForm projectId={projectId} onSuccess={handleRefresh} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t("moodboard.searchPlaceholder")}
              className="pl-9 w-full bg-white transition-all focus:ring-2 focus:ring-blue-500/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative inline-block w-full sm:w-48">
              <select
                className="w-full h-9 pl-3 pr-8 bg-white border border-gray-200 rounded-md text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="favorites">{t("common.sortFavorites")}</option>
                <option value="newest">{t("common.sortNewest")}</option>
                <option value="oldest">{t("common.sortOldest")}</option>
                <option value="alphabetical">
                  {t("common.sortAlphabetical")}
                </option>
              </select>
              <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {filteredAndSortedGroups.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">
            {searchQuery ? t("common.noResults") : t("moodboard.noGroups")}
          </p>
          {!searchQuery && (
            <p className="text-sm text-gray-400 mt-2">
              {t("moodboard.groupsPrompt")}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex gap-1 overflow-x-auto border-b">
            {filteredAndSortedGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => setActiveGroup(group.id)}
                aria-pressed={selectedGroup?.id === group.id}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm ${selectedGroup?.id === group.id ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}
              >
                {group.name}
              </button>
            ))}
          </div>
          {filteredAndSortedGroups
            .filter((group) => group.id === selectedGroup?.id)
            .map((group) => (
              <MoodboardGroup
                key={`${group.id}-${group.order}`}
                group={group}
                projectId={projectId}
                galleryLayout={galleryLayout}
                hasLocalMedia={hasLocalMedia}
                onUpdate={handleRefresh}
                onDelete={handleRefresh}
                showFavorites={showFavorites}
              />
            ))}
        </div>
      )}
    </>
  );
}
