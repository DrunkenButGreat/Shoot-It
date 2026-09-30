"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, CheckCircle2, ChevronRight, FolderKanban, Search } from "lucide-react"
import { ProjectCard } from "./ProjectCard"
import { ProjectForm } from "./ProjectForm"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/components/I18nProvider"

export interface DashboardProject {
  id: string
  name: string
  description: string | null
  date: string | null
  location: string | null
  shortCode: string
  isArchived: boolean
  previewImage: string | null
  participantCount: number
  selectionCount: number
  resultCount: number
}

export function DashboardContent({ projects }: { projects: DashboardProject[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<"active" | "archived">("active")
  const [query, setQuery] = useState("")
  const { t, locale } = useI18n()
  const activeProjects = projects.filter(project => !project.isArchived)
  const upcoming = useMemo(() => activeProjects.filter(project => project.date && new Date(project.date) >= new Date(new Date().setHours(0, 0, 0, 0))).sort((a, b) => +new Date(a.date!) - +new Date(b.date!)).slice(0, 3), [projects])
  const filtered = projects.filter(project => (tab === "active" ? !project.isArchived : project.isArchived) && project.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="studio-page-title">{t("dashboard.studioOverview")}</h1><p className="studio-page-subtitle">{t("dashboard.studioOverviewDescription")}</p></div>
        <ProjectForm onSuccess={() => router.refresh()} />
      </div>
      <div className="mb-8 flex flex-wrap gap-x-10 gap-y-4 border-b border-[#e2e5ea] pb-7">
        {[[activeProjects.length, t("dashboard.activeProjects")], [upcoming.length, t("dashboard.upcomingShoots")], [activeProjects.filter(project => project.selectionCount > 0 && project.resultCount === 0).length, t("dashboard.openSelections")]].map(([count, label]) => <div key={label} className="flex min-w-[170px] items-baseline gap-3 border-r border-[#e2e5ea] pr-10 last:border-0"><strong className="text-3xl text-slate-950">{count}</strong><span className="text-sm text-slate-500">{label}</span></div>)}
      </div>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_310px]">
        <section id="projects" className="scroll-mt-24">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-2xl font-bold text-slate-950">{t("dashboard.yourProjects")}</h2><div className="mt-3 flex gap-5">
              <button onClick={() => setTab("active")} className={`border-b-2 pb-2 text-sm font-medium ${tab === "active" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>{t("common.active")} <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs">{activeProjects.length}</span></button>
              <button onClick={() => setTab("archived")} className={`border-b-2 pb-2 text-sm font-medium ${tab === "archived" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}>{t("common.archived")} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{projects.length - activeProjects.length}</span></button>
            </div></div>
            <label className="relative block w-full sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><span className="sr-only">{t("dashboard.searchProjects")}</span><Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t("dashboard.searchProjects")} className="bg-white pl-9" /></label>
          </div>
          {filtered.length === 0 ? <div className="studio-panel p-12 text-center text-slate-500">{tab === "active" ? t("common.noActiveProjects") : t("common.noArchivedProjects")}</div> : <div className="grid gap-5 md:grid-cols-2">{filtered.map(project => <ProjectCard key={project.id} project={project} />)}</div>}
        </section>
        <aside className="space-y-5">
          <section className="studio-panel p-5"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-950">{t("dashboard.upNext")}</h2><CalendarDays className="h-5 w-5 text-slate-400" /></div>
            {upcoming.length ? <div className="divide-y divide-[#e2e5ea]">{upcoming.map(project => <button key={project.id} onClick={() => router.push(`/project/${project.id}`)} className="flex w-full items-center gap-4 py-4 text-left"><div className="w-11 shrink-0 text-center"><strong className="block text-xl text-slate-950">{new Date(project.date!).getDate().toString().padStart(2, "0")}</strong><span className="text-xs text-slate-500">{new Date(project.date!).toLocaleDateString(locale, { month: "short" })}</span></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-950">{project.name}</p><p className="truncate text-xs text-slate-500">{project.location || t("common.tbd")}</p></div><ChevronRight className="h-4 w-4 text-slate-400" /></button>)}</div> : <p className="py-6 text-sm text-slate-500">{t("dashboard.noUpcomingShoots")}</p>}
          </section>
          <section className="studio-panel p-5"><h2 className="mb-4 text-lg font-bold text-slate-950">{t("dashboard.nextSteps")}</h2><div className="space-y-2">
            <div className="flex items-center gap-3 rounded-lg border border-[#e2e5ea] p-3"><CheckCircle2 className="h-5 w-5 text-blue-600" /><div><p className="text-sm font-medium">{t("dashboard.reviewSelections")}</p><p className="text-xs text-slate-500">{activeProjects.filter(project => project.selectionCount > 0).length} {t("dashboard.projects")}</p></div></div>
            <div className="flex items-center gap-3 rounded-lg border border-[#e2e5ea] p-3"><FolderKanban className="h-5 w-5 text-blue-600" /><div><p className="text-sm font-medium">{t("dashboard.prepareProjects")}</p><p className="text-xs text-slate-500">{upcoming.length} {t("dashboard.upcomingShoots")}</p></div></div>
          </div></section>
        </aside>
      </div>
    </div>
  )
}
