import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Calendar, MapPin } from "lucide-react"
import prisma from "@/lib/prisma"
import { canAccessProject } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProjectActions } from "@/components/projects/ProjectActions"
import { PublicLinkCard } from "@/components/projects/PublicLinkCard"
import { getLocale, getDictionary } from "@/lib/i18n"
import { cookies } from "next/headers"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { id } = await params
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore)
  const dict = await getDictionary(locale)

  // Check access
  const hasAccess = await canAccessProject(session.user.id, id)
  if (!hasAccess) {
    redirect("/dashboard")
  }

  // Fetch project with counts
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          moodboardLinks: true,
          participants: true,
          contracts: true,
          selectionImages: true,
          resultFolders: true,
          applications: true,
          appointmentSlots: true,
        },
      },
      participants: {
        where: { email: session.user.email || undefined },
        select: { id: true, role: true }
      },
    },
  })

  const isParticipant = (project?.participants?.length ?? 0) > 0
  const participantRole = project?.participants?.[0]?.role

  if (!project) {
    redirect("/dashboard")
  }

  const isOwner = project.ownerId === session.user.id
  const projectDate = project.date ? new Date(project.date) : null

  return (
    <div className="flex-1 bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {dict.common.backToProjects}
              </Button>
            </Link>
            {isOwner && (
              <ProjectActions project={project as any} />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Project Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            {project.isArchived && (
              <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded border border-amber-200 uppercase tracking-wider">
                {dict.common.archived}
              </span>
            )}
            {isParticipant && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded border border-blue-200 uppercase tracking-wider">
                {participantRole || dict.common.participant}
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-gray-600">{project.description}</p>
          )}
          <div className="flex gap-4 mt-4 text-sm text-gray-600">
            {projectDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{projectDate.toLocaleDateString(locale)}</span>
              </div>
            )}
            {project.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{project.location}</span>
              </div>
            )}
          </div>
          {project.address && (
            <p className="text-sm text-gray-500 mt-2">{project.address}</p>
          )}
        </div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{dict.project.moodboard}</CardTitle>
              <CardDescription>{dict.project.groups.replace('{count}', project._count.moodboardLinks.toString())}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/moodboard`}>
                <Button variant="outline" className="w-full">
                  {dict.project.manage} {dict.project.moodboard}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{dict.project.participants}</CardTitle>
              <CardDescription>{dict.project.people.replace('{count}', project._count.participants.toString())}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/participants`}>
                <Button variant="outline" className="w-full">
                  {dict.project.manage} {dict.project.participants}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{dict.project.contracts}</CardTitle>
              <CardDescription>{dict.project.contractsCount.replace('{count}', project._count.contracts.toString())}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/contracts`}>
                <Button variant="outline" className="w-full">
                  {dict.project.manage} {dict.project.contracts}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{dict.project.selection}</CardTitle>
              <CardDescription>{dict.project.imagesCount.replace('{count}', project._count.selectionImages.toString())}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/selection`}>
                <Button variant="outline" className="w-full">
                  {dict.selection.title}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Project Info & Public Link */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Card className="border-none shadow-lg bg-white">
            <CardHeader>
              <CardTitle className="text-lg">{dict.project.databaseInfo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-medium">{dict.common.owner}:</span>{" "}
                <span className="text-sm text-gray-600">{project.owner.name || project.owner.email}</span>
              </div>
              <div>
                <span className="text-sm font-medium">{dict.project.internalId}:</span>{" "}
                <code className="text-[10px] bg-gray-100 px-2 py-1 rounded font-mono">{project.id}</code>
              </div>
              <div>
                <span className="text-sm font-medium">{dict.project.shortCode}:</span>{" "}
                <code className="text-sm bg-gray-100 px-2 py-1 rounded">{project.shortCode}</code>
              </div>
            </CardContent>
          </Card>

          <PublicLinkCard project={project as any} />
        </div>

        {/* Additional Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{dict.project.callsheet}</CardTitle>
              <CardDescription>{dict.callsheet.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/callsheet`}>
                <Button variant="outline" className="w-full">
                  {dict.project.manage} {dict.project.callsheet}
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{dict.project.results}</CardTitle>
              <CardDescription>{dict.project.foldersCount.replace('{count}', project._count.resultFolders.toString())}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/results`}>
                <Button variant="outline" className="w-full">
                  {dict.project.manage} {dict.project.results}
                </Button>
              </Link>
            </CardContent>
          </Card>

          {project.allowAppointments && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{dict.project.appointments || 'Terminfindung'}</CardTitle>
                <CardDescription>
                  {project._count.appointmentSlots > 0 
                    ? `${project._count.appointmentSlots} Terminvorschläge` 
                    : (dict.project.appointmentsDescription || 'Findet gemeinsam einen Termin')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/project/${id}/appointments`}>
                  <Button variant="outline" className="w-full">
                    {dict.project.manage} {dict.project.appointments || 'Termine'}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {isOwner && (project.allowApplications || project._count.applications > 0) && (
            <Card className={project._count.applications > 0 ? "border-blue-200 bg-blue-50/20" : ""}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  {dict.applications.manageApplications}
                  {project._count.applications > 0 && (
                    <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {project._count.applications}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  {dict.applications.sectionDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/project/${id}/applications`}>
                  <Button variant={project._count.applications > 0 ? "default" : "outline"} className="w-full">
                    {dict.project.manage}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
