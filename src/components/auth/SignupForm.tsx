"use client";

import { useState } from "react";
import { PasswordInput } from "./PasswordInput";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

import type { RegistrationMode } from "@prisma/client";

export default function SignupForm({ mode }: { mode: RegistrationMode }) {
  const { t } = useI18n();
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          inviteCode,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(t(`auth.${data.error || "errorOccurred"}`));
      }

      // Redirect to login page on success
      router.push("/login?registered=true");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : t("auth.errorOccurred"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {t("auth.createAccount")}
        </h1>
        <p className="mt-2 text-gray-600">
          {t(
            mode === "CLOSED"
              ? "auth.registrationClosed"
              : mode === "INVITE_ONLY"
                ? "auth.inviteRequired"
                : "auth.signUpToGetStarted",
          )}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      {mode !== "CLOSED" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("auth.name")}
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              required
              disabled={isLoading}
            />
          </div>

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 px-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              required
              minLength={6}
              disabled={isLoading}
            />
          </div>

          {mode === "INVITE_ONLY" && (
            <div>
              <label
                htmlFor="inviteCode"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("auth.inviteCode")}
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                maxLength={128}
                autoComplete="off"
                spellCheck={false}
                disabled={isLoading}
                className="h-11 w-full rounded-lg border border-gray-300 px-3 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="h-11 w-full rounded-lg bg-blue-600 px-4 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isLoading ? t("auth.registering") : t("auth.signup")}
          </button>
        </form>
      )}

      <div className="text-center text-sm text-gray-600">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          {t("auth.signIn")}
        </Link>
      </div>
    </div>
  );
}
