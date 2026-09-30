"use client"

import Link from "next/link"
import { Archive, ArchiveRestore, Calendar, MapPin, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useI18n } from "@/components/I18nProvider"
import type { DashboardProject } from "./DashboardContent"

export function ProjectCard({ project }: { project: DashboardProject }) {
  const router = useRouter()
  const [updating, setUpdating] = useState(false)
  const { t, locale } = useI18n()
  const projectDate = project.date ? new Date(project.date) : null
  const status = project.isArchived ? t("common.archived") : project.resultCount > 0 ? t("dashboard.resultsReady") : project.selectionCount > 0 ? t("dashboard.inSelection") : t("dashboard.planning")
  const toggleArchive = async (event: React.MouseEvent) => {
    event.preventDefault(); event.stopPropagation(); setUpdating(true)
    try { if ((await fetch(`/api/projects/${project.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isArchived: !project.isArchived }) })).ok) router.refresh() } finally { setUpdating(false) }
  }
  return <Link href={`/project/${project.id}`} className="group overflow-hidden rounded-xl border border-[#e2e5ea] bg-white transition-colors hover:border-slate-300">
    <div className="relative aspect-[16/7] overflow-hidden bg-[#d9dde3]">
      {project.previewImage ? <img src={project.previewImage} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" /> : <div className="h-full w-full bg-[linear-gradient(135deg,#d8dde5,#eef0f3_55%,#cbd2db)]" />}
      <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-700"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-blue-600" />{status}</span>
      <Button variant="secondary" size="icon" onClick={toggleArchive} disabled={updating} title={project.isArchived ? t("common.unarchive") : t("common.archive")} className="absolute right-3 top-3 h-9 w-9 rounded-full bg-white/95 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">{project.isArchived ? <ArchiveRestore /> : <Archive />}</Button>
    </div>
    <div className="p-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-slate-950">{project.name}</h3>{project.description && <p className="line-clamp-1 text-sm text-slate-500">{project.description}</p>}</div><span className="flex items-center gap-1 text-xs text-slate-500"><Users className="h-3.5 w-3.5" />{project.participantCount}</span></div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#e2e5ea] pt-3 text-sm text-slate-500">{projectDate && <span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{projectDate.toLocaleDateString(locale)}</span>}{project.location && <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{project.location}</span>}</div>
    </div>
  </Link>
}
