import { cleanupExpiredApplications } from '@/lib/application-cleanup'
import { cleanupPendingFiles } from '@/lib/file-cleanup'

let running = false

export async function runCleanups() {
  if (running) return
  running = true
  try {
    for (const cleanup of [cleanupExpiredApplications, cleanupPendingFiles]) {
      try {
        await cleanup()
      } catch (error) {
        console.error('Background cleanup failed:', error)
      }
    }
  } finally {
    running = false
  }
}

export function startCleanupScheduler() {
  const state = globalThis as typeof globalThis & { shootItCleanupTimer?: ReturnType<typeof setInterval> }
  if (state.shootItCleanupTimer) return
  void runCleanups()
  state.shootItCleanupTimer = setInterval(() => void runCleanups(), 60_000)
  state.shootItCleanupTimer.unref()
}
