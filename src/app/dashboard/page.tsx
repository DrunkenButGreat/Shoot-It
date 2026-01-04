import { auth } from "@/auth"
import { redirect } from "next/navigation"
import UserMenu from "@/components/auth/UserMenu"

export default async function DashboardPage() {
  const session = await auth()
  
  if (!session) {
    redirect("/login")
  }

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
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">My Projects</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            + New Project
          </button>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-gray-500">No projects yet</p>
            <p className="text-sm text-gray-400 mt-2">Create your first project to get started</p>
          </div>
        </div>
      </main>
    </div>
  )
}
