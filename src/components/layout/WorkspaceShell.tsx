"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileSignature,
  FolderKanban,
  Images,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  UserRoundSearch,
  X,
} from "lucide-react"
import { BrandMark } from "./BrandMark"
import UserMenu from "@/components/auth/UserMenu"
import { useI18n } from "@/components/I18nProvider"
import packageInfo from "../../../package.json"

type RecentProject = { id: string; name: string }
type ProjectNav = { id: string; name: string; showApplications?: boolean }

export function WorkspaceShell({
  children,
  recentProjects = [],
  project,
  isAdmin = false,
}: {
  children: React.ReactNode
  recentProjects?: RecentProject[]
  project?: ProjectNav
  isAdmin?: boolean
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { t } = useI18n()

  const globalLinks = [
    { href: "/dashboard", label: t("nav.overview"), icon: LayoutDashboard, exact: true },
    { href: "/dashboard#projects", label: t("nav.projects"), icon: FolderKanban, exact: true },
    { href: "/dashboard/moodboards", label: t("nav.moodboards"), icon: Images },
  ]
  const projectLinks = project ? [
    { href: `/project/${project.id}`, label: t("nav.overview"), icon: LayoutDashboard, exact: true },
    { href: `/project/${project.id}/participants`, label: t("project.participants"), icon: Users },
    { href: `/project/${project.id}/moodboard`, label: t("project.moodboard"), icon: Images },
    { href: `/project/${project.id}/selection`, label: t("project.selection"), icon: UserRoundSearch },
    { href: `/project/${project.id}/contracts`, label: t("project.contracts"), icon: FileSignature },
    { href: `/project/${project.id}/callsheet`, label: t("project.callsheet"), icon: ClipboardList },
    { href: `/project/${project.id}/results`, label: t("project.results"), icon: FolderKanban },
    { href: `/project/${project.id}/appointments`, label: t("project.appointments"), icon: CalendarDays },
    ...(project.showApplications ? [{ href: `/project/${project.id}/applications`, label: t("applications.manageApplications"), icon: UserRoundSearch }] : []),
  ] : []

  const active = (href: string, exact?: boolean) => exact ? pathname === href : pathname.startsWith(href)

  const nav = (
    <>
      <div className="px-5 pb-5 pt-6"><BrandMark inverse /></div>
      <div className="mx-4 mb-4 flex h-11 items-center justify-between rounded-lg border border-white/10 px-3 text-sm text-white">
        <span>{t("nav.myStudio")}</span><ChevronDown className="h-4 w-4 text-slate-400" />
      </div>
      <nav className="space-y-1 px-3" aria-label={t("nav.mainNavigation")}>
        {globalLinks.map(({ href, label, icon: Icon, exact }) => (
          <Link key={`${href}-${label}`} href={href} onClick={() => setOpen(false)} className={`studio-nav-link ${active(href, exact) ? "studio-nav-link-active" : ""}`}>
            <Icon className="h-[18px] w-[18px]" /> <span>{label}</span>
          </Link>
        ))}
      </nav>
      {project ? (
        <div className="mt-5 border-t border-white/10 pt-5">
          <p className="px-5 pb-2 text-[11px] font-medium text-slate-500">{t("nav.currentProject")}</p>
          <p className="truncate px-5 pb-3 text-sm font-semibold text-white">{project.name}</p>
          <nav className="space-y-1 px-3" aria-label={t("nav.projectNavigation")}>
            {projectLinks.map(({ href, label, icon: Icon, exact }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={`studio-nav-link ${active(href, exact) ? "studio-nav-link-active" : ""}`}>
                <Icon className="h-[17px] w-[17px]" /> <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      ) : recentProjects.length > 0 ? (
        <div className="mt-5 border-t border-white/10 px-5 pt-5">
          <p className="pb-3 text-[11px] font-medium text-slate-500">{t("nav.recentlyOpened")}</p>
          <div className="space-y-1.5">
            {recentProjects.map(item => <Link key={item.id} href={`/project/${item.id}`} className="block truncate py-1 text-sm text-slate-300 transition-colors hover:text-white">{item.name}</Link>)}
          </div>
        </div>
      ) : null}
      <div className="mt-auto border-t border-white/10 p-3">
        {isAdmin && <Link href="/admin" className={`studio-nav-link ${pathname === "/admin" ? "studio-nav-link-active" : ""}`}><ShieldCheck className="h-[18px] w-[18px]" />{t("admin.navigation")}</Link>}
        <Link href="/dashboard/profile" className={`studio-nav-link ${pathname === "/dashboard/profile" ? "studio-nav-link-active" : ""}`}><Settings className="h-[18px] w-[18px]" />{t("nav.settings")}</Link>
        <p className="px-3 pt-3 text-[10px] text-slate-600">v{packageInfo.version}</p>
      </div>
    </>
  )

  return (
    <div className="studio-shell">
      <aside className="studio-sidebar hidden lg:flex">{nav}</aside>
      {open && <button className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" aria-label={t("common.close")} onClick={() => setOpen(false)} />}
      <aside className={`studio-sidebar fixed inset-y-0 left-0 z-50 flex transition-transform lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-md p-2 text-slate-300 hover:bg-white/10" aria-label={t("common.close")}><X className="h-5 w-5" /></button>
        {nav}
      </aside>
      <div className="min-w-0 flex-1 lg:pl-[232px]">
        <header className="studio-topbar">
          <button className="rounded-md p-2 text-slate-700 lg:hidden" onClick={() => setOpen(true)} aria-label={t("nav.openNavigation")}><Menu className="h-5 w-5" /></button>
          <p className="hidden truncate text-sm text-slate-500 sm:block">{project ? `${t("nav.myStudio")} / ${project.name}` : `${t("nav.myStudio")} / ${t("nav.overview")}`}</p>
          <div className="ml-auto"><UserMenu /></div>
        </header>
        <div className="workspace-page">{children}</div>
      </div>
    </div>
  )
}
