import { Suspense } from "react"
import LoginForm from "@/components/auth/LoginForm"

export default function LoginPage() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-blue-50 to-violet-50 px-4">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
