import { useState, useEffect, useRef } from "react"

// Reveals a large list in batches as a sentinel scrolls into view, keeping the
// number of mounted DOM nodes (and, for grids, in-flight image requests) bounded.
// Resets to the first batch whenever the input list changes (e.g. folder switch).
export function useIncrementalReveal<T>(items: T[], batch = 40) {
  const [count, setCount] = useState(batch)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setCount(batch)
  }, [items, batch])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || count >= items.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setCount((c) => Math.min(c + batch, items.length))
        }
      },
      { rootMargin: "600px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [count, items.length, batch])

  return {
    visible: items.slice(0, count),
    hasMore: count < items.length,
    sentinelRef,
  }
}
