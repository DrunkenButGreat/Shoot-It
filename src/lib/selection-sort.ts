export type SelectionSort = "imported" | "name" | "captured-asc" | "captured-desc";

export function sortSelectionImages<T extends { filename: string; capturedAt?: string | Date | null }>(images: T[], sort: SelectionSort): T[] {
  if (sort === "imported") return images;
  return [...images].sort((a, b) => {
    if (sort === "name") return a.filename.localeCompare(b.filename, undefined, { numeric: true });
    const first = a.capturedAt ? new Date(a.capturedAt).getTime() : NaN;
    const second = b.capturedAt ? new Date(b.capturedAt).getTime() : NaN;
    if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
    if (!Number.isFinite(second)) return -1;
    return sort === "captured-asc" ? first - second : second - first;
  });
}
