import { Suspense } from "react"
import LoginForm from "@/components/auth/LoginForm"
import { cookies } from "next/headers"
import { getDictionary, getLocale } from "@/lib/i18n"
import { getRegistrationMode } from "@/lib/registration"

export default async function LoginPage() {
  const mode = await getRegistrationMode()
  const dict = await getDictionary(getLocale(await cookies()))
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-violet-50 px-4">
      <Suspense fallback={<div>{dict.common.loading}</div>}>
        <LoginForm mode={mode} />
      </Suspense>
    </div>
  )
}
