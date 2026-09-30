'use client';

import { useI18n } from './I18nProvider';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <label className="relative">
      <span className="sr-only">Language</span>
      <select value={locale} onChange={event => setLocale(event.target.value as "de" | "en")} className="h-9 cursor-pointer appearance-none rounded-md border-0 bg-transparent py-1 pl-2 pr-7 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-600">
        <option value="de">DE</option><option value="en">EN</option>
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">⌄</span>
    </label>
  );
}
