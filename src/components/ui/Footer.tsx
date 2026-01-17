"use client"

import { useI18n } from "@/components/I18nProvider"
import { version } from "../../../package.json"

export default function Footer() {
  const { t } = useI18n()
  
  return (
    <footer className="w-full py-6 mt-auto border-t border-gray-200 bg-white/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
        <p>
          {t('common.madeWith')} ❤️ {t('common.forPhotographers')}
        </p>
        <p className="mt-1 text-xs opacity-70">
          Version {version}
        </p>
      </div>
    </footer>
  )
}
