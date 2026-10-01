import Link from "next/link";
import { cookies } from "next/headers";
import { Images, ListChecks, Users } from "lucide-react";
import { getLocale, getDictionary } from "@/lib/i18n";
import { BrandMark } from "@/components/layout/BrandMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default async function HomePage() {
  const t = await getDictionary(getLocale(await cookies()));
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex h-20 max-w-[1440px] items-center px-5 sm:px-8">
        <BrandMark />
        <nav className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="hidden rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:block"
          >
            {t.auth.login}
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t.home.getStarted}
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-8">
        <section className="relative min-h-[570px] overflow-hidden rounded-2xl bg-slate-100">
          <img
            src="/images/design/coastal-editorial.webp"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-right sm:object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/65 to-transparent" />
          <div className="relative flex min-h-[570px] max-w-2xl flex-col justify-center p-7 sm:p-14">
            <h1 className="whitespace-pre-line text-4xl font-bold leading-[1.02] tracking-[-0.04em] text-slate-950 sm:text-6xl">
              {t.home.heroTitle}
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
              {t.home.heroDescription}
            </p>
            <div className="mt-8">
              <Link
                href="/signup"
                className="inline-flex h-12 items-center rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {t.home.getStarted} →
              </Link>
            </div>
          </div>
        </section>
        <section className="grid border-b border-slate-200 sm:grid-cols-3">
          {[
            [ListChecks, t.home.plan, t.home.planDescription],
            [Users, t.home.collaborate, t.home.collaborateDescription],
            [Images, t.home.share, t.home.shareDescription],
          ].map(([Icon, title, description]) => {
            const FeatureIcon = Icon as typeof ListChecks;
            return (
              <div
                key={String(title)}
                className="border-slate-200 px-6 py-10 sm:border-r sm:last:border-r-0"
              >
                <FeatureIcon className="h-6 w-6 text-slate-800" />
                <h2 className="mt-5 text-lg font-bold text-slate-950">
                  {String(title)}
                </h2>
                <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
                  {String(description)}
                </p>
              </div>
            );
          })}
        </section>
      </main>
    </div>
  );
}
