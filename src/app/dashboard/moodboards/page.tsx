import { auth } from "@/auth"
import { redirect } from "next/navigation"
import UserMenu from "@/components/auth/UserMenu"
import prisma from "@/lib/prisma"
import { getLocale, getDictionary } from "@/lib/i18n"
import { cookies } from "next/headers"
import { MoodboardCollection } from "@/components/moodboard/MoodboardCollection"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function MoodboardDashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const cookieStore = await cookies()
  const locale = getLocale(cookieStore)
  const dict = await getDictionary(locale)

  // Fetch user's private moodboard collection
  const groups = await prisma.moodboardGroup.findMany({
    where: {
      ownerId: session.user.id,
    },
    include: {
      images: {
        orderBy: { order: 'asc' },
      },
      _count: {
        select: { projectLinks: true }
      }
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Ensure groups have empty comments/status for the collection view
  const formattedGroups = groups.map(g => ({
    ...g,
    status: 'PENDING',
    comments: [],
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {dict.common.backToProjects}
                </Button>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">{dict.moodboard.privateCollection || "Meine Moodboards"}</h1>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MoodboardCollection initialGroups={formattedGroups as any} />
      </main>
    </div>
  )
}
