"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { RegistrationMode } from "@prisma/client"
import { useI18n } from "@/components/I18nProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Invite = { id: string; createdAt: string; expiresAt: string; usedAt: string | null; revokedAt: string | null }
type User = { id: string; name: string | null; email: string; createdAt: string; isAdmin: boolean; isOwner: boolean }

export default function AdminDashboard({ mode, invites, users }: { mode: RegistrationMode; invites: Invite[]; users: User[] }) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const [selectedMode, setSelectedMode] = useState(mode)
  const [days, setDays] = useState(7)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const date = (value: string) => new Date(value).toLocaleString(locale)

  async function submit(body: object) {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) throw new Error(t(`admin.${result.error || "errorOccurred"}`))
      if (result.code) setCode(result.code)
      setNotice(t("admin.saved"))
      router.refresh()
    } catch (error) {
      setError(error instanceof Error ? error.message : t("admin.errorOccurred"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{notice}</p>}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-xl border bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold">{t("admin.registration")}</h2>
          <p className="mt-2 text-sm text-gray-600">{t("admin.registrationHelp")}</p>
          <form onSubmit={e => { e.preventDefault(); void submit({ action: "mode", mode: selectedMode }) }} className="mt-5 space-y-4">
            <fieldset disabled={busy} className="space-y-3">
              <legend className="sr-only">{t("admin.registration")}</legend>
              {(["OPEN", "INVITE_ONLY", "CLOSED"] as const).map(value => (
                <label key={value} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${selectedMode === value ? "border-blue-500 bg-blue-50" : "border-gray-200"}`}>
                  <input className="mt-1 accent-blue-600" type="radio" name="registrationMode" value={value} checked={selectedMode === value} onChange={() => setSelectedMode(value)} />
                  <span><span className="block font-medium">{t(`admin.${value}`)}</span><span className="block mt-1 text-sm text-gray-600">{t(`admin.${value}Help`)}</span></span>
                </label>
              ))}
            </fieldset>
            <Button disabled={busy || selectedMode === mode}>{t("admin.save")}</Button>
          </form>
        </section>
        <section className="rounded-xl border bg-white p-5 sm:p-6">
          <h2 className="text-xl font-semibold">{t("admin.createInvite")}</h2>
          <p className="mt-2 text-sm text-gray-600">{t("admin.inviteHelp")}</p>
          <form onSubmit={e => { e.preventDefault(); void submit({ action: "invite", days }) }} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-days">{t("admin.validDays")}</Label>
              <Input id="invite-days" type="number" min={1} max={90} required value={days} disabled={busy} onChange={e => setDays(Number(e.target.value))} />
            </div>
            <Button disabled={busy}>{t("admin.createInvite")}</Button>
          </form>
          {code && <div className="mt-5 rounded-lg bg-blue-50 border border-blue-200 p-4 space-y-3">
            <Label htmlFor="invite-code">{t("admin.code")}</Label>
            <Input id="invite-code" readOnly value={code} onFocus={e => e.target.select()} className="bg-white font-mono" />
            <p className="text-sm text-blue-900">{t("admin.copyNow")}</p>
            <Button variant="outline" disabled={busy} onClick={async () => {
              try { await navigator.clipboard.writeText(code); setNotice(t("admin.copied")) }
              catch { setError(t("admin.copyFailed")) }
            }}>{t("admin.copy")}</Button>
          </div>}
        </section>
      </div>
      <section className="rounded-xl border bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold">{t("admin.invites")}</h2>
        <p className="mt-2 text-sm text-gray-600">{t("admin.latestInvites")}</p>
        {invites.length === 0 ? <p className="py-6 text-gray-500">{t("admin.noInvites")}</p> : (
          <ul className="mt-4 divide-y">
            {invites.map(invite => {
              const status = invite.usedAt ? "used" : invite.revokedAt ? "revoked" : new Date(invite.expiresAt).getTime() <= Date.now() ? "expired" : "active"
              return <li key={invite.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 text-sm space-y-1">
                  <p className="font-medium">{t("admin.created")}: {date(invite.createdAt)}</p>
                  <p className="text-gray-600">{t("admin.expires")}: {date(invite.expiresAt)}</p>
                  <p className="text-xs text-gray-500 break-all">{invite.id}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${status === "active" ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-600"}`}>{t(`admin.${status}`)}</span>
                  {status === "active" && <Button variant="outline" size="sm" disabled={busy} aria-label={`${t("admin.revoke")} ${invite.id}`} onClick={() => void submit({ action: "revoke", id: invite.id })}>{t("admin.revoke")}</Button>}
                </div>
              </li>
            })}
          </ul>
        )}
      </section>
      <section className="rounded-xl border bg-white p-5 sm:p-6">
        <h2 className="text-xl font-semibold">{t("admin.latestUsers")}</h2>
        <ul className="mt-4 divide-y">
          {users.map(user => <li key={user.id} className="py-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0"><p className="font-medium break-words">{user.name || user.email}</p><p className="text-sm text-gray-600 break-all">{user.email}</p></div>
            <div className="text-sm text-gray-600">{user.isAdmin && <span className="mr-3 rounded-full bg-blue-50 text-blue-700 px-3 py-1">{t(user.isOwner ? "admin.owner" : "admin.administrator")}</span>}<span>{date(user.createdAt)}</span></div>
          </li>)}
        </ul>
      </section>
    </div>
  )
}
