"use client";

import { useI18n } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function UserMenu() {
  const { data: session } = useSession();
  const { t } = useI18n();

  if (!session?.user) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <LanguageSwitcher />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t("auth.profile")}
            className="flex min-h-11 items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-gray-100"
          >
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                {session.user.name?.[0]?.toUpperCase() ||
                  session.user.email?.[0]?.toUpperCase() ||
                  "U"}
              </div>
            )}
            <span className="hidden text-sm font-medium text-gray-700 xl:block">
              {session.user.name || session.user.email}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile">{t("auth.profile")}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/moodboards">
              {t("moodboard.privateCollection")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })}>
            {t("auth.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
