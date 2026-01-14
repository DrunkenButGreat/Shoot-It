'use client';

import { useI18n } from './I18nProvider';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex gap-1 items-center bg-gray-100 p-1 rounded-lg">
      <Button
        variant={locale === 'de' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setLocale('de')}
        className="px-2 h-7 rounded-md text-xs"
      >
        DE
      </Button>
      <Button
        variant={locale === 'en' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setLocale('en')}
        className="px-2 h-7 rounded-md text-xs"
      >
        EN
      </Button>
    </div>
  );
}
