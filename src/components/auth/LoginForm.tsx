"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { PasswordInput } from "./PasswordInput";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

import type { RegistrationMode } from "@prisma/client";

export default function LoginForm({ mode }: { mode: RegistrationMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const { t } = useI18n();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t("auth.invalidEmail"));
      } else {
        window.location.href = callbackUrl;
      }
    } catch (error) {
      setError(t("auth.errorOccurred"));
    } finally {
      setIsLoading(false);
    }
  };

  const authError = searchParams.get("error");
  const message =
    error ||
    (authError
      ? t(
          `auth.${["registrationClosed", "oauthInviteRequired"].includes(authError) ? authError : "errorOccurred"}`,
        )
      : "");

  return (
    <div className="w-full max-w-md space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("auth.welcomeBack")}
        </h1>
        <p className="mt-2 text-gray-600">{t("auth.signInToAccount")}</p>
      </div>

      {message && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t("auth.password")}
          </label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-lg border border-gray-300 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            required
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="h-11 w-full rounded-lg bg-blue-600 px-4 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {isLoading ? t("auth.signingIn") : t("auth.signIn")}
        </button>
      </form>

      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        <span>{t("auth.or")}</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        className="flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <span className="font-bold text-blue-600">G</span>
        {t("auth.signInWithGoogle")}
      </button>

      {mode !== "CLOSED" && (
        <div className="text-center text-sm text-gray-600 mt-4">
          {t("auth.noAccount")}{" "}
          <a href="/signup" className="text-blue-600 hover:underline">
            {t(
              mode === "INVITE_ONLY" ? "auth.signupWithInvite" : "auth.signup",
            )}
          </a>
        </div>
      )}
    </div>
  );
}
