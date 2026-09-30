import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { DashboardContent } from "@/components/projects/DashboardContent"
import prisma from "@/lib/prisma"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        {
          access: {
            some: { userId: session.user.id },
          },
        },
        {
          participants: {
            some: { email: session.user.email },
          },
        },
      ],
    },
    include: {
      _count: { select: { participants: true, selectionImages: true, resultFolders: true } },
      moodboardLinks: {
        take: 1,
        orderBy: { order: "asc" },
        include: { group: { include: { images: { take: 1, orderBy: { order: "asc" } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return (
    <main><DashboardContent projects={projects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      date: project.date?.toISOString() ?? null,
      location: project.location,
      shortCode: project.shortCode,
      isArchived: project.isArchived,
      previewImage: project.brandingImage || project.moodboardLinks[0]?.group.images[0]?.thumbnail || project.moodboardLinks[0]?.group.images[0]?.path || null,
      participantCount: project._count.participants,
      selectionCount: project._count.selectionImages,
      resultCount: project._count.resultFolders,
    }))} /></main>
  )
}
