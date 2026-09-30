import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { ProfileForm } from "@/components/auth/ProfileForm"
import { getLocale, getDictionary } from "@/lib/i18n"
import { cookies } from "next/headers"

export default async function ProfilePage() {
    const session = await auth()
    const cookieStore = await cookies()
    const locale = getLocale(cookieStore)
    const dict = await getDictionary(locale)

    if (!session?.user?.id) {
        redirect("/login")
    }

    return <main className="mx-auto max-w-[1500px]">
        <div className="mb-7">
            <h1 className="studio-page-title">{dict.profile.yourProfile}</h1>
            <p className="studio-page-subtitle">{dict.profile.description}</p>
        </div>
        <ProfileForm />
    </main>
}
