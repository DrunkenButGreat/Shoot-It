import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import prisma from "@/lib/prisma"
import { canAccessProject } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { ParticipantsContent } from "@/components/participants/ParticipantsContent"

export default async function ParticipantsPage({
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

  // Fetch project and participants
  const [project, participants] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            bio: true,
            image: true,
          }
        }
      },
    }) as any,
    prisma.participant.findMany({
      where: { projectId: id },
      include: {
        images: true,
        customFields: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  if (!project) {
    redirect("/dashboard")
  }

  // Check if owner is already in the participants list
  const ownerInParticipants = participants.some(p => p.userId === project.owner.id || p.email === project.owner.email)

  const allParticipants = [...participants]

  if (!ownerInParticipants) {
    // Add owner as a virtual participant or first item
    allParticipants.unshift({
      id: `owner-${project.owner.id}`,
      name: project.owner.name || "Owner",
      email: project.owner.email,
      phone: project.owner.phone,
      role: project.owner.role || "Project Owner",
      notes: project.owner.bio,
      createdAt: new Date(),
      images: [],
      customFields: [],
      userId: project.owner.id,
      user: {
        id: project.owner.id,
        name: project.owner.name,
        image: project.owner.image,
      }
    } as any)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href={`/project/${id}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Project
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500">Participants</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ParticipantsContent projectId={id} initialParticipants={allParticipants} />
      </main>
    </div>
  )
}
