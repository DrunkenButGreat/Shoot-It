import { getLocale, getDictionary } from "@/lib/i18n";

export default async function HomePage() {
  const locale = await getLocale();
  const t = await getDictionary(locale);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-violet-50">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl font-bold text-gray-900">
          {t.home.title}
        </h1>
        <p className="text-xl text-gray-600">
          {t.home.subtitle}
        </p>
        <div className="pt-4">
          <a
            href="/dashboard"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t.home.getStarted}
          </a>
        </div>
      </div>
    </div>
  );
}
