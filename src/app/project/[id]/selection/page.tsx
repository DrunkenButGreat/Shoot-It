import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import prisma from "@/lib/prisma"
import { canAccessProject } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { SelectionContent } from "@/components/selection/SelectionContent"
import { getLocale, getDictionary } from "@/lib/i18n"
import { cookies } from "next/headers"

export default async function SelectionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore)
  const dict = await getDictionary(locale)

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { id } = await params
  // Check access
  const hasAccess = await canAccessProject(session.user.id, id)
  if (!hasAccess) {
    redirect("/dashboard")
  }

  // Fetch project, folders and selection images
  const [project, folders, images] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        galleryLayout: true,
        showSelectionFolders: true,
      } as any,
    }) as any,
    prisma.selectionFolder.findMany({
      where: { projectId: id },
      include: {
        _count: { select: { images: true } }
      }
    }),
    prisma.selectionImage.findMany({
      where: { projectId: id },
      select: { id: true, filename: true, path: true, thumbnail: true, width: true, height: true, folderId: true, ratings: { select: { id: true, stars: true, color: true } } },
      orderBy: { importedAt: 'desc' },
    }),
  ])

  if (!project) {
    redirect("/dashboard")
  }

  return (
    <div className="flex-1 bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href={`/project/${id}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {dict.common.backToProject}
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500">{dict.project.selection}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SelectionContent
          projectId={id}
          initialImages={images as any}
          initialFolders={folders.map(folder => ({ ...folder, images: [] }))}
          userId={session.user.id}
          galleryLayout={project.galleryLayout}
          hasLocalMedia={!!process.env.LOCAL_MEDIA_PATH}
          showFolders={project.showSelectionFolders}
        />
      </main>
    </div>
  )
}
