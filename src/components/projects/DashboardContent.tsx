"use client"

import { useState } from "react"
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
  isArchived: boolean
}

interface DashboardContentProps {
  projects: Project[]
}

export function DashboardContent({ projects }: DashboardContentProps) {
  const router = useRouter()
  const [currentTab, setCurrentTab] = useState<'active' | 'archived'>('active')

  const handleProjectCreated = () => {
    router.refresh()
  }

  const filteredProjects = projects.filter(p =>
    currentTab === 'active' ? !p.isArchived : p.isArchived
  )

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Projects</h2>
          <div className="flex gap-4 mt-2">
            <button
              onClick={() => setCurrentTab('active')}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${currentTab === 'active'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Active
            </button>
            <button
              onClick={() => setCurrentTab('archived')}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${currentTab === 'archived'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Archived
            </button>
          </div>
        </div>
        <ProjectForm onSuccess={handleProjectCreated} />
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">
            {currentTab === 'active' ? 'No active projects' : 'No archived projects'}
          </p>
          {currentTab === 'active' && (
            <p className="text-sm text-gray-400 mt-2">Create your first project to get started</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  )
}
