import prisma from '@/lib/prisma'

export async function getSiteImages() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 'global' } })
  return {
    landingImage: settings?.landingImage || '/images/design/coastal-editorial.webp',
    loginImage: settings?.loginImage || '/images/design/coastal-portrait.webp',
    signupImage: settings?.signupImage || '/images/design/studio-camera.webp',
  }
}
