"use client"

import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useI18n } from "@/components/I18nProvider"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"

export default function UserMenu() {
  const { data: session } = useSession()
  const { t } = useI18n()

  if (!session?.user) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <LanguageSwitcher />
      
      <div className="relative group">
        <button className="flex min-h-11 items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-gray-100">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name || "User"}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
              {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase() || "U"}
            </div>
          )}
          <span className="hidden text-sm font-medium text-gray-700 xl:block">
            {session.user.name || session.user.email}
          </span>
        </button>

        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
          <div className="py-1">
            <Link
              href="/dashboard/profile"
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              {t('auth.profile')}
            </Link>
            <Link
              href="/dashboard/moodboards"
              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
            >
              {t('moodboard.privateCollection')}
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 border-t border-gray-100"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
