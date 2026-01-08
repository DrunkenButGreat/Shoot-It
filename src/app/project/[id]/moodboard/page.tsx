import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import prisma from "@/lib/prisma"
import { canAccessProject } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { MoodboardContent } from "@/components/moodboard/MoodboardContent"

export default async function MoodboardPage({
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

  // Fetch project and moodboard groups
  const [project, groups] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        galleryLayout: true,
      } as any,
    }) as any,
    prisma.moodboardGroup.findMany({
      where: { projectId: id },
      include: {
        images: {
          orderBy: { order: 'asc' },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { order: 'asc' },
    }),
  ])

  if (!project) {
    redirect("/dashboard")
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
                <p className="text-sm text-gray-500">Moodboard</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MoodboardContent
          projectId={id}
          initialGroups={groups}
          galleryLayout={project.galleryLayout}
          hasLocalMedia={!!process.env.LOCAL_MEDIA_PATH}
        />
      </main>
    </div>
  )
}
