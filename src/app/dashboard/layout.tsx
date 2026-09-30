import { auth } from "@/auth"
import { WorkspaceShell } from "@/components/layout/WorkspaceShell"
import { getAdmin } from "@/lib/admin"
import prisma from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const [recentProjects, isAdmin] = await Promise.all([
    prisma.project.findMany({ where: { OR: [{ ownerId: session.user.id }, { access: { some: { userId: session.user.id } } }] }, orderBy: { updatedAt: "desc" }, take: 3, select: { id: true, name: true } }),
    getAdmin(),
  ])
  return <WorkspaceShell recentProjects={recentProjects} isAdmin={!!isAdmin}>{children}</WorkspaceShell>
}
