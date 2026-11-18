export type SelectionSort = "imported" | "name" | "captured-asc" | "captured-desc" | "stars-asc" | "stars-desc" | "color-asc" | "color-desc";

export function sortSelectionImages<T extends { filename: string; ratings?: { stars: number | null; color: string | null } | null; capturedAt?: string | Date | null }>(images: T[], sort: SelectionSort): T[] {
  if (sort === "imported") return images;
  return [...images].sort((a, b) => {
    if (sort.startsWith("stars-") || sort.startsWith("color-")) {
      const colors = ["RED", "YELLOW", "GREEN"];
      const rank = (item: T) => sort.startsWith("stars-") ? item.ratings?.stars || 0 : colors.indexOf(item.ratings?.color || "") + 1;
      const x = rank(a), y = rank(b);
      if (!x || !y) return Number(!x) - Number(!y);
      return sort.endsWith("-asc") ? x - y : y - x;
    }
    if (sort === "name") return a.filename.localeCompare(b.filename, undefined, { numeric: true });
    const first = a.capturedAt ? new Date(a.capturedAt).getTime() : NaN;
    const second = b.capturedAt ? new Date(b.capturedAt).getTime() : NaN;
    if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
    if (!Number.isFinite(second)) return -1;
    return sort === "captured-asc" ? first - second : second - first;
  });
}
