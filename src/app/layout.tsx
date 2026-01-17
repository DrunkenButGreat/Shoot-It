import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/auth/AuthProvider";
import { cookies } from "next/headers";
import { getLocale, getDictionary } from "@/lib/i18n";
import { I18nProvider } from "@/components/I18nProvider";
import Footer from "@/components/ui/Footer";

export const metadata: Metadata = {
  title: "PhotoShoot Organizer",
  description: "Professional photoshoot organization made easy",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = getLocale(cookieStore);
  const dictionary = await getDictionary(locale);

  return (
    <html lang={locale}>
      <body className="antialiased min-h-screen flex flex-col">
        <I18nProvider initialLocale={locale} initialDictionary={dictionary}>
          <AuthProvider>
            <div className="flex-1 flex flex-col">
              {children}
            </div>
            <Footer />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
