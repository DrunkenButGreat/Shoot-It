import prisma from './prisma'
import { ProjectRole } from '@prisma/client'

export async function canAccessProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      access: {
        where: { userId },
      },
    },
  })

  if (!project) return false
  if (project.ownerId === userId) return true
  if (project.access.length > 0) return true

  return false
}

export async function canEditProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      access: {
        where: { userId },
      },
    },
  })

  if (!project) return false
  if (project.ownerId === userId) return true
  if (project.access.some(a => a.role === ProjectRole.EDITOR)) return true

  return false
}

export async function getUserRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      access: {
        where: { userId },
      },
    },
  })

  if (!project) return null
  if (project.ownerId === userId) return ProjectRole.OWNER
  if (project.access.length > 0) return project.access[0].role

  return null
}
