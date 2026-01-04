import { auth } from "@/auth"
import { redirect } from "next/navigation"
import UserMenu from "@/components/auth/UserMenu"
import { DashboardContent } from "@/components/projects/DashboardContent"
import prisma from "@/lib/prisma"

export default async function DashboardPage() {
  const session = await auth()
  
  if (!session) {
    redirect("/login")
  }

  // Fetch user's projects
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: session.user.id },
        {
          access: {
            some: { userId: session.user.id },
          },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">PhotoShoot Organizer</h1>
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardContent projects={projects} />
      </main>
    </div>
  )
}
