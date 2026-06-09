// Derives the small grid-thumbnail URL for a gallery image.
//
// The grid thumb lives next to the original as `thumb_<basename>.webp` — the same
// naming the upload routes write and that the on-the-fly handler in
// `api/uploads/[...path]/route.ts` resolves. We derive it from `path` (the original),
// NOT from `thumbnail`: scan-import routes set `thumbnail` to the original itself
// (no `preview_`), so deriving from `path` is uniform across every code path.
export function gridThumbUrl(image: {
  path: string
  thumbnail?: string | null
  isVideo?: boolean
}): string {
  // Videos have no Sharp-generated thumb — fall back to the poster (preview) or original.
  if (image.isVideo) return image.thumbnail || image.path

  const i = image.path.lastIndexOf('/')
  const dir = image.path.slice(0, i)
  const base = image.path.slice(i + 1)
  return `${dir}/thumb_${base}.webp`
}
