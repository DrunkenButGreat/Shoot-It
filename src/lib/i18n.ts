import 'server-only';

export type Locale = 'de' | 'en';

const dictionaries = {
  de: () => import('@/dictionaries/de.json').then((module) => module.default),
  en: () => import('@/dictionaries/en.json').then((module) => module.default),
};

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]();
};

export const getLocale = (cookies: any): Locale => {
  const locale = cookies.get('NEXT_LOCALE')?.value;
  return (locale === 'en' ? 'en' : 'de') as Locale;
};
