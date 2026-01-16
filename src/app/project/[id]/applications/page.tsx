import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { canAccessProject } from "@/lib/permissions"
import { getLocale, getDictionary } from "@/lib/i18n"
import { cookies } from "next/headers"
import { ApplicationsContent } from "@/components/applications/ApplicationsContent"

export default async function ApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { id } = await params
  const cookieStore = await cookies()
  const locale = getLocale(cookieStore)
  const dict = await getDictionary(locale)

  // Check access (only owner can manage applications)
  const project = await prisma.project.findUnique({
    where: { id },
    select: { ownerId: true }
  })

  if (!project || project.ownerId !== session.user.id) {
    redirect(`/project/${id}`)
  }

  const applications = await prisma.projectApplication.findMany({
    where: { projectId: id },
    include: {
      images: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <ApplicationsContent 
      projectId={id}
      applications={applications as any}
      dict={dict}
      locale={locale}
    />
  )
}
