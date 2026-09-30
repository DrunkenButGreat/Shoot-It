import { auth } from "@/auth"
import { WorkspaceShell } from "@/components/layout/WorkspaceShell"
import { getAdmin } from "@/lib/admin"
import prisma from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const { id } = await params
  const [project, isAdmin] = await Promise.all([
    prisma.project.findUnique({ where: { id }, select: { id: true, name: true, ownerId: true, allowApplications: true, _count: { select: { applications: true } } } }),
    getAdmin(),
  ])
  if (!project) notFound()
  return <WorkspaceShell isAdmin={!!isAdmin} project={{ id, name: project.name, showApplications: project.ownerId === session.user.id && (project.allowApplications || project._count.applications > 0) }}>{children}</WorkspaceShell>
}
