import { Suspense } from "react"
import LoginForm from "@/components/auth/LoginForm"
import { cookies } from "next/headers"
import { getDictionary, getLocale } from "@/lib/i18n"
import { getRegistrationMode } from "@/lib/registration"
import { BrandMark } from "@/components/layout/BrandMark"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"

export default async function LoginPage() {
  const mode = await getRegistrationMode()
  const dict = await getDictionary(getLocale(await cookies()))
  return <main className="grid min-h-screen bg-white lg:grid-cols-[46%_54%]">
    <section className="relative hidden overflow-hidden bg-slate-900 lg:block"><img src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=85&w=1600" alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-black/30" /><div className="absolute left-10 top-9"><BrandMark inverse /></div><p className="absolute bottom-10 left-10 text-lg font-medium text-white">{dict.auth.creativityCaption}</p></section>
    <section className="relative flex items-center justify-center px-5 py-16"><div className="absolute right-6 top-5"><LanguageSwitcher /></div><Suspense fallback={<div>{dict.common.loading}</div>}><LoginForm mode={mode} /></Suspense></section>
  </main>
}
