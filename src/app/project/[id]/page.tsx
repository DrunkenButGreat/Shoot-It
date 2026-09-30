import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Calendar, CalendarDays, ClipboardList, FileSignature, FolderKanban, Images, MapPin, UserRoundSearch, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import prisma from "@/lib/prisma"
import { canAccessProject } from "@/lib/permissions"
import { ProjectActions } from "@/components/projects/ProjectActions"
import { PublicLinkCard } from "@/components/projects/PublicLinkCard"
import { getLocale, getDictionary } from "@/lib/i18n"
import { cookies } from "next/headers"

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { id } = await params
  if (!await canAccessProject(session.user.id, id)) redirect("/dashboard")
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore)
  const [dict, project] = await Promise.all([
    getDictionary(locale),
    prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { moodboardLinks: true, participants: true, contracts: true, selectionImages: true, resultFolders: true, applications: true, appointmentSlots: true } },
        participants: { where: { email: session.user.email || undefined }, select: { id: true, role: true } },
        moodboardLinks: { take: 1, orderBy: { order: "asc" }, include: { group: { include: { images: { take: 3, orderBy: { order: "asc" } } } } } },
      },
    }),
  ])
  if (!project) redirect("/dashboard")
  const projectDate = project.date ? new Date(project.date) : null
  const isOwner = project.ownerId === session.user.id
  const hero = project.brandingImage || project.moodboardLinks[0]?.group.images[0]?.thumbnail || project.moodboardLinks[0]?.group.images[0]?.path
  const modules: Array<[string, string, string, LucideIcon]> = [
    [dict.project.moodboard, dict.project.groups.replace("{count}", String(project._count.moodboardLinks)), `/project/${id}/moodboard`, Images],
    [dict.project.participants, dict.project.people.replace("{count}", String(project._count.participants)), `/project/${id}/participants`, Users],
    [dict.project.selection, dict.project.imagesCount.replace("{count}", String(project._count.selectionImages)), `/project/${id}/selection`, UserRoundSearch],
    [dict.project.contracts, dict.project.contractsCount.replace("{count}", String(project._count.contracts)), `/project/${id}/contracts`, FileSignature],
    [dict.project.callsheet, dict.callsheet.subtitle, `/project/${id}/callsheet`, ClipboardList],
    [dict.project.results, dict.project.foldersCount.replace("{count}", String(project._count.resultFolders)), `/project/${id}/results`, FolderKanban],
  ]
  if (project.allowAppointments) modules.push([dict.project.appointments, `${project._count.appointmentSlots} ${dict.project.appointmentSuggestions}`, `/project/${id}/appointments`, CalendarDays])
  if (isOwner && (project.allowApplications || project._count.applications > 0)) modules.push([dict.applications.manageApplications, `${project._count.applications} ${dict.applications.pending}`, `/project/${id}/applications`, Users])

  return <main className="mx-auto max-w-[1500px]">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="studio-page-title">{project.name}</h1>{project.description && <p className="studio-page-subtitle">{project.description}</p>}<div className="mt-3 flex flex-wrap gap-5 text-sm text-slate-500">{projectDate && <span className="flex items-center gap-2"><Calendar className="h-4 w-4" />{projectDate.toLocaleDateString(locale)}</span>}{project.location && <span className="flex items-center gap-2"><MapPin className="h-4 w-4" />{project.location}</span>}</div></div>
      {isOwner && <ProjectActions project={project} />}
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="space-y-6">
        <div className="relative aspect-[16/5] min-h-52 overflow-hidden rounded-xl bg-slate-200">{hero ? <img src={hero} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-[linear-gradient(135deg,#cbd2db,#eef0f3_55%,#bbc4cf)]" />}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-5 pt-16"><p className="text-sm font-medium text-white">{projectDate ? projectDate.toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : dict.common.tbd}</p></div></div>
        <section><h2 className="mb-4 text-xl font-bold text-slate-950">{dict.project.projectModules}</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{modules.map(([title, subtitle, href, Icon]) => <Link href={href} key={href} className="studio-panel group flex min-h-32 flex-col p-4 transition-colors hover:border-slate-300"><div className="mb-5 flex items-center justify-between"><span className="rounded-lg bg-slate-100 p-2 text-slate-600"><Icon className="h-5 w-5" /></span><span className="text-blue-600">→</span></div><h3 className="font-semibold text-slate-950">{title}</h3><p className="mt-1 text-xs text-slate-500">{subtitle}</p></Link>)}</div></section>
      </div>
      <aside className="space-y-5">
        <section className="studio-panel p-5"><h2 className="mb-4 text-lg font-bold text-slate-950">{dict.project.shootingDetails}</h2><dl className="space-y-4 text-sm"><div><dt className="text-xs text-slate-500">{dict.projectForm.date}</dt><dd className="mt-1 font-medium">{projectDate ? projectDate.toLocaleDateString(locale) : dict.common.tbd}</dd></div><div><dt className="text-xs text-slate-500">{dict.projectForm.location}</dt><dd className="mt-1 font-medium">{project.location || dict.common.tbd}</dd>{project.address && <dd className="text-xs text-slate-500">{project.address}</dd>}</div><div><dt className="text-xs text-slate-500">{dict.common.owner}</dt><dd className="mt-1 font-medium">{project.owner.name || project.owner.email}</dd></div></dl></section>
        <PublicLinkCard project={project as any} />
      </aside>
    </div>
  </main>
}
