import Link from "next/link"
import { Calendar, MapPin, Archive, ArchiveRestore } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface Project {
  id: string
  name: string
  description: string | null
  date: Date | string | null
  location: string | null
  shortCode: string
  isArchived: boolean
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const projectDate = project.date ? new Date(project.date) : null
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)

  const toggleArchive = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !project.isArchived }),
      })

      if (response.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to toggle archive status:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Link href={`/project/${project.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer relative group">
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle>{project.name}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={toggleArchive}
              disabled={isUpdating}
              title={project.isArchived ? "Unarchive" : "Archive"}
            >
              {project.isArchived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
            </Button>
          </div>
          {project.description && (
            <CardDescription className="line-clamp-2">
              {project.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            {projectDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{projectDate.toLocaleDateString()}</span>
              </div>
            )}
            {project.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{project.location}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
