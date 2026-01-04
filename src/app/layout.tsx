import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "PhotoShoot Organizer",
  description: "Professional photoshoot organization made easy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
