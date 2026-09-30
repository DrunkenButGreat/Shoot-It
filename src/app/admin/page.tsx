import Link from "next/link"
import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { getAdmin } from "@/lib/admin"
import { getRegistrationMode } from "@/lib/registration"
import { getDictionary, getLocale } from "@/lib/i18n"
import prisma from "@/lib/prisma"
import UserMenu from "@/components/auth/UserMenu"
import AdminDashboard from "@/components/admin/AdminDashboard"

export default async function AdminPage() {
  if (!await getAdmin()) notFound()
  const dict = await getDictionary(getLocale(await cookies()))
  const [mode, userCount, projectCount, activeInvites, invites, users] = await Promise.all([
    getRegistrationMode(),
    prisma.user.count(),
    prisma.project.count(),
    prisma.registrationInvite.count({ where: { usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.registrationInvite.findMany({
      orderBy: { createdAt: "desc" }, take: 50,
      select: { id: true, createdAt: true, expiresAt: true, usedAt: true, revokedAt: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, name: true, email: true, createdAt: true, isAdmin: true },
    }),
  ])

  return (
    <div className="flex-1 bg-gray-50">
      <header className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← {dict.dashboard.title}</Link>
          <UserMenu />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{dict.admin.title}</h1>
          <p className="mt-2 text-gray-600">{dict.admin.description}</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[[dict.admin.users, userCount], [dict.admin.projects, projectCount], [dict.admin.activeInvites, activeInvites]].map(([label, count]) => (
            <div key={label} className="bg-white rounded-xl border p-5">
              <p className="text-sm text-gray-600">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{count}</p>
            </div>
          ))}
        </div>
        <AdminDashboard
          mode={mode}
          invites={invites.map(invite => ({ ...invite, createdAt: invite.createdAt.toISOString(), expiresAt: invite.expiresAt.toISOString(), usedAt: invite.usedAt?.toISOString() ?? null, revokedAt: invite.revokedAt?.toISOString() ?? null }))}
          users={users.map(user => ({ ...user, createdAt: user.createdAt.toISOString() }))}
        />
      </main>
    </div>
  )
}
