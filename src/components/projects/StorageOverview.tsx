"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, HardDrive } from "lucide-react"
import { useI18n } from "@/components/I18nProvider"
import { formatBytes } from "@/lib/format-bytes"

export interface StorageOverviewData {
  totalBytes: number
  projects: Array<{ id: string; name: string; isArchived: boolean; imageCount: number; bytes: number }>
}

export function StorageOverview({ storage }: { storage: StorageOverviewData }) {
  const { t, locale } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const projects = [...storage.projects].sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name, locale))
  const largest = projects[0]?.bytes ?? 0

  return (
    <section className="studio-panel overflow-hidden" aria-labelledby="storage-title">
      <div className="border-b border-border p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="storage-title" className="text-lg font-bold text-slate-950">{t("dashboard.storageTitle")}</h2>
          <span className="rounded-lg bg-blue-50 p-2 text-blue-600"><HardDrive aria-hidden="true" className="h-5 w-5" /></span>
        </div>
        <p className="mt-4 break-words text-3xl font-semibold tracking-tight text-slate-950 tabular-nums">{formatBytes(storage.totalBytes, locale)}</p>
        <p className="mt-1 text-sm text-slate-600">{t("dashboard.storageTotal")}</p>
      </div>
      {projects.length === 0 ? (
        <p className="p-5 text-sm leading-relaxed text-slate-600">{t("dashboard.storageEmpty")}</p>
      ) : (
        <div className="p-5">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{t("dashboard.storageLargest")}</h3>
          <ul id="storage-projects" className="space-y-1">
            {projects.map((project, index) => (
              <li key={project.id} hidden={!expanded && index >= 3}>
                <Link href={`/project/${project.id}`} className="-mx-2 block rounded-lg p-2 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-slate-950 [overflow-wrap:anywhere]">{project.name}</p>
                      <p className="mt-0.5 text-xs text-slate-600">{project.imageCount} {t(project.imageCount === 1 ? "dashboard.storageImage" : "dashboard.storageImages")}{project.isArchived && <span className="ml-2">{t("common.archived")}</span>}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap font-medium text-slate-700 tabular-nums">{formatBytes(project.bytes, locale)}</span>
                  </div>
                  {largest > 0 && <div aria-hidden="true" className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${project.bytes / largest * 100}%` }} /></div>}
                </Link>
              </li>
            ))}
          </ul>
          {projects.length > 3 && <button type="button" aria-expanded={expanded} aria-controls="storage-projects" onClick={() => setExpanded(!expanded)} className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50">
            {t(expanded ? "dashboard.storageShowLess" : "dashboard.storageShowAll")}
            <ChevronDown aria-hidden="true" className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`} />
          </button>}
        </div>
      )}
      <p className="border-t border-border px-5 py-4 text-xs leading-relaxed text-slate-600">{t("dashboard.storageSharedHint")}</p>
    </section>
  )
}
