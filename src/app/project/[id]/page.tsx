import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Calendar, MapPin } from "lucide-react"
import prisma from "@/lib/prisma"
import { canAccessProject } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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
          moodboardGroups: true,
          participants: true,
          contracts: true,
          selectionImages: true,
          resultFolders: true,
        },
      },
      participants: {
        where: { email: session.user.email || undefined },
        select: { id: true, role: true }
      }
    },
  })

  const isParticipant = (project?.participants?.length ?? 0) > 0
  const participantRole = project?.participants?.[0]?.role

  if (!project) {
    redirect("/dashboard")
  }

  const projectDate = new Date(project.date)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Button>
            </Link>
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
                Archived
              </span>
            )}
            {isParticipant && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded border border-blue-200 uppercase tracking-wider">
                {participantRole || 'Participant'}
              </span>
            )}
          </div>
          {project.description && (
            <p className="text-gray-600">{project.description}</p>
          )}
          <div className="flex gap-4 mt-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{projectDate.toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{project.location}</span>
            </div>
          </div>
          {project.address && (
            <p className="text-sm text-gray-500 mt-2">{project.address}</p>
          )}
        </div>

        {/* Module Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Moodboard</CardTitle>
              <CardDescription>{project._count.moodboardGroups} groups</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/moodboard`}>
                <Button variant="outline" className="w-full">
                  Manage Moodboard
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Participants</CardTitle>
              <CardDescription>{project._count.participants} people</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/participants`}>
                <Button variant="outline" className="w-full">
                  Manage Participants
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contracts</CardTitle>
              <CardDescription>{project._count.contracts} contracts</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/contracts`}>
                <Button variant="outline" className="w-full">
                  Manage Contracts
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Selection</CardTitle>
              <CardDescription>{project._count.selectionImages} images</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/selection`}>
                <Button variant="outline" className="w-full">
                  Selection Gallery
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm font-medium">Owner:</span>{" "}
              <span className="text-sm text-gray-600">{project.owner.name || project.owner.email}</span>
            </div>
            <div>
              <span className="text-sm font-medium">Short Code:</span>{" "}
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">{project.shortCode}</code>
            </div>
            <div>
              <span className="text-sm font-medium">Public Link:</span>{" "}
              <a
                href={`/p/${project.shortCode}`}
                className="text-sm text-blue-600 hover:underline"
                target="_blank"
              >
                /p/{project.shortCode}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Additional Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Callsheet</CardTitle>
              <CardDescription>Schedule and logistics</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/callsheet`}>
                <Button variant="outline" className="w-full">
                  Manage Callsheet
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Results</CardTitle>
              <CardDescription>{project._count.resultFolders} folders</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/project/${id}/results`}>
                <Button variant="outline" className="w-full">
                  Manage Results
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
