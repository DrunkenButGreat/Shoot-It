import { auth } from "@/auth"
import { redirect } from "next/navigation"
import UserMenu from "@/components/auth/UserMenu"
import { ProfileForm } from "@/components/auth/ProfileForm"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

export default async function ProfilePage() {
    const session = await auth()

    if (!session?.user?.id) {
        redirect("/login")
    }

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10 backdrop-blur-md bg-white/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/dashboard"
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                title="Zurück zum Dashboard"
                            >
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </Link>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                                Profil-Einstellungen
                            </h1>
                        </div>
                        <UserMenu />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-8">
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dein Profil</h2>
                    <p className="mt-2 text-lg text-gray-600">
                        Verwalte deine persönlichen Informationen für alle Shootings.
                    </p>
                </div>

                <ProfileForm />
            </main>
        </div>
    )
}
