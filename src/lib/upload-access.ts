import prisma from '@/lib/prisma'
import { canAccessProject } from '@/lib/permissions'

const projectSelect = {
  id: true, ownerId: true, isPublic: true, showMoodboardPublicly: true,
  showParticipantsPublicly: true, showSelectionPublicly: true,
  showResultsPublicly: true, allowSelectionDownload: true,
} as const

type Project = { id: string; isPublic: boolean }
async function visible(project: Project, publicModule: boolean, userId?: string) {
  return (project.isPublic && publicModule) || (!!userId && await canAccessProject(userId, project.id))
}

/** Authorize recorded assets, including library images linked from another project. */
export async function canReadUpload(url: string, userId?: string): Promise<boolean> {
  const parts = url.slice('/api/uploads/'.length).split('/')
  const filename = parts.at(-1) || ''
  const originalUrl = filename.startsWith('preview_') && filename.endsWith('.webp')
    ? `${url.slice(0, url.lastIndexOf('/') + 1)}${filename.slice(8, -5)}` : url
  const assetWhere = { OR: [{ path: originalUrl }, { thumbnail: url }] }

  if (parts[0] === 'site') {
    return !!await prisma.siteSettings.findFirst({
      where: { id: 'global', OR: [{ landingImage: url }, { loginImage: url }, { signupImage: url }] },
      select: { id: true },
    })
  }
  if (parts[0] === 'users') {
    const owner = await prisma.user.findFirst({
      where: { id: parts[1], OR: [{ brandingImage: url }, { image: url }] },
      select: { id: true, image: true, brandingImage: true },
    })
    if (!owner) return false
    if (owner.id === userId) return true
    const projects = await prisma.project.findMany({
      where: { OR: [{ ownerId: owner.id }, { participants: { some: { userId: owner.id } } }] },
      select: { ...projectSelect, coverHidden: true, brandingImage: true },
    })
    for (const project of projects) {
      const publicAsset = project.ownerId === owner.id
        ? owner.image === url || (owner.brandingImage === url && !project.coverHidden && !project.brandingImage)
        : owner.image === url && project.showParticipantsPublicly
      if (await visible(project, publicAsset, userId)) return true
    }
    return false
  }
  if (parts[0] === 'projects' && parts[2] === 'branding') {
    const project = await prisma.project.findFirst({
      where: { id: parts[1], brandingImage: url }, select: projectSelect,
    })
    return !!project && await visible(project, true, userId)
  }
  if (parts[0] === 'projects' && parts[2] === 'participants') {
    const image = await prisma.participantImage.findFirst({
      where: assetWhere, select: { participant: { select: { project: { select: projectSelect } } } },
    })
    const project = image?.participant.project
    return !!project && await visible(project, project.showParticipantsPublicly, userId)
  }
  if (parts[0] === 'applications') {
    const image = await prisma.applicationImage.findFirst({
      where: assetWhere,
      select: { application: { select: { userId: true, project: { select: { ownerId: true } } } } },
    })
    return !!userId && !!image && (image.application.userId === userId || image.application.project.ownerId === userId)
  }
  if (parts[0] === 'moodboard') {
    const image = await prisma.moodboardImage.findFirst({
      where: assetWhere,
      select: { group: { select: { ownerId: true, projectLinks: { select: { project: { select: projectSelect } } } } } },
    })
    if (!image) return false
    if (userId && image.group.ownerId === userId) return true
    for (const { project } of image.group.projectLinks) {
      if (await visible(project, project.showMoodboardPublicly, userId)) return true
    }
    return false
  }
  if (parts[0] === 'selection') {
    const image = await prisma.selectionImage.findFirst({
      where: assetWhere, select: { path: true, project: { select: projectSelect } },
    })
    return !!image && await visible(image.project,
      image.project.showSelectionPublicly && (url !== image.path || image.project.allowSelectionDownload), userId)
  }
  if (parts[0] === 'results') {
    const image = await prisma.resultFile.findFirst({
      where: assetWhere, select: { project: { select: projectSelect } },
    })
    return !!image && await visible(image.project, image.project.showResultsPublicly, userId)
  }
  return false
}
