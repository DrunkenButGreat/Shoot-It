export function matchesSelectionFilters(
  image: { folderId?: string | null; ratings: { stars: number | null; color: string | null } | null },
  filters: { folderId: string | null; stars: string[]; colors: string[]; unrated: boolean },
) {
  return (filters.folderId === 'unassigned' ? !image.folderId : !filters.folderId || image.folderId === filters.folderId)
    && (!filters.unrated || (!image.ratings?.stars && !image.ratings?.color))
    && (!filters.stars.length || filters.stars.includes(String(image.ratings?.stars)))
    && (!filters.colors.length || filters.colors.includes(image.ratings?.color || ''))
}
