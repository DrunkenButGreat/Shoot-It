import { auth } from "@/auth"
import { WorkspaceShell } from "@/components/layout/WorkspaceShell"
import { getAdmin } from "@/lib/admin"
import { redirect } from "next/navigation"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  const isAdmin = await getAdmin()
  return <WorkspaceShell isAdmin={!!isAdmin}>{children}</WorkspaceShell>
}
