import SignupForm from "@/components/auth/SignupForm"

import { getRegistrationMode } from "@/lib/registration"

export default async function SignupPage() {
    const mode = await getRegistrationMode()
    return (
        <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-violet-50 px-4 py-8">
            <SignupForm mode={mode} />
        </div>
    )
}
