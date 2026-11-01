/** Reuse the single reduced asset produced on upload; downloads keep image.path. */
export function imagePreviewSource(
  image: { path: string; thumbnail?: string | null; isVideo?: boolean },
): string {
  if (image.thumbnail && image.thumbnail !== image.path) return image.thumbnail
  if (image.isVideo || !image.path.startsWith('/api/uploads/')) return image.path
  // Legacy local-media imports sometimes reference the original as thumbnail.
  // The existing upload route creates this same canonical preview only if absent.
  const url = new URL(image.path, 'http://local.invalid')
  const split = url.pathname.lastIndexOf('/')
  url.pathname = `${url.pathname.slice(0, split + 1)}preview_${url.pathname.slice(split + 1)}.webp`
  return `${url.pathname}${url.search}`
}
