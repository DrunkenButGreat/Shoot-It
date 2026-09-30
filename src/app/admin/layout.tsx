import { WorkspaceShell } from "@/components/layout/WorkspaceShell"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell isAdmin>{children}</WorkspaceShell>
}
