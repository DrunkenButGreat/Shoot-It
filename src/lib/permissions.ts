import prisma from './prisma'
import { ProjectRole } from '@prisma/client'

export async function canAccessProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  })

  if (!user) return false

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      access: {
        where: { userId },
      },
      participants: {
        where: { email: user.email },
      },
    },
  })

  if (!project) return false
  if (project.ownerId === userId) return true
  if (project.access.length > 0) return true
  if (project.participants.length > 0) return true

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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  })

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      access: {
        where: { userId },
      },
      participants: {
        where: { email: user?.email || undefined },
      },
    },
  })

  if (!project) return null
  if (project.ownerId === userId) return ProjectRole.OWNER
  if (project.access.length > 0) return project.access[0].role
  if (project.participants.length > 0) return ProjectRole.VIEWER

  return null
}
