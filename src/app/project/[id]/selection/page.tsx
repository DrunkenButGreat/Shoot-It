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
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await auth()
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore)
  const dict = await getDictionary(locale)

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { id } = await params
  const sParams = await searchParams
  const starsParam = sParams.stars
  const colorParam = sParams.color

  const stars = Array.isArray(starsParam) 
    ? starsParam.map(s => parseInt(s)).filter(n => !isNaN(n))
    : (starsParam && !isNaN(parseInt(starsParam)) ? [parseInt(starsParam)] : [])
  
  const colors = Array.isArray(colorParam)
    ? colorParam as string[]
    : (colorParam ? [colorParam as string] : [])

  // Check access
  const hasAccess = await canAccessProject(session.user.id, id)
  if (!hasAccess) {
    redirect("/dashboard")
  }

  // Build filter
  const where: any = { projectId: id }
  if (stars.length > 0 || colors.length > 0) {
    where.ratings = {
      some: {
        userId: session.user.id,
        ...(stars.length > 0 ? { stars: { in: stars } } : {}),
        ...(colors.length > 0 ? { color: { in: colors } } : {}),
      }
    }
  }

  // Fetch project and selection images
  const [project, images] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        galleryLayout: true,
      } as any,
    }) as any,
    prisma.selectionImage.findMany({
      where,
      include: {
        ratings: {
          where: {
            userId: session.user.id,
          },
        },
      },
      orderBy: { importedAt: 'desc' },
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
                  {dict.common.backToProject}
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500">Selection Gallery</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <SelectionContent
          projectId={id}
          initialImages={images}
          userId={session.user.id}
          galleryLayout={project.galleryLayout}
          hasLocalMedia={!!process.env.LOCAL_MEDIA_PATH}
        />
      </main>
    </div>
  )
}
