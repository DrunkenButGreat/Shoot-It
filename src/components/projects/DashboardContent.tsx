"use client"

import { useRouter } from "next/navigation"
import { ProjectCard } from "./ProjectCard"
import { ProjectForm } from "./ProjectForm"

interface Project {
  id: string
  name: string
  description: string | null
  date: Date | string
  location: string
  shortCode: string
}

interface DashboardContentProps {
  projects: Project[]
}

export function DashboardContent({ projects }: DashboardContentProps) {
  const router = useRouter()

  const handleProjectCreated = () => {
    router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">My Projects</h2>
        <ProjectForm onSuccess={handleProjectCreated} />
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">No projects yet</p>
          <p className="text-sm text-gray-400 mt-2">Create your first project to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  )
}
