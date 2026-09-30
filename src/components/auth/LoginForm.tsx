"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useI18n } from "@/components/I18nProvider"

import type { RegistrationMode } from "@prisma/client"

export default function LoginForm({ mode }: { mode: RegistrationMode }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const { t } = useI18n()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(t("auth.invalidEmail"))
      } else {
        window.location.href = callbackUrl
      }
    } catch (error) {
      setError(t("auth.errorOccurred"))
    } finally {
      setIsLoading(false)
    }
  }

  const authError = searchParams.get("error")
  const message = error || (authError ? t(`auth.${["registrationClosed", "oauthInviteRequired"].includes(authError) ? authError : "errorOccurred"}`) : "")

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">{t("auth.welcomeBack")}</h1>
        <p className="mt-2 text-gray-600">{t("auth.signInToAccount")}</p>
      </div>

      {message && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      {mode !== "CLOSED" && <div className="text-center text-sm text-gray-600 mt-4">
        {t("auth.noAccount")}{" "}
        <a href="/signup" className="text-blue-600 hover:underline">
          {t(mode === "INVITE_ONLY" ? "auth.signupWithInvite" : "auth.signup")}
        </a>
      </div>}
    </div>
  )
}
