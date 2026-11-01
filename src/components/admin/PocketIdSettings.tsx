"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useI18n } from "@/components/I18nProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Settings = { publicUrl: string; enabled: boolean; issuer: string; clientId: string; hasClientSecret: boolean }

const withDiscoveryUrl = (settings: Settings) => ({ ...settings, issuer: settings.issuer && !settings.issuer.endsWith("/.well-known/openid-configuration") ? `${settings.issuer}/.well-known/openid-configuration` : settings.issuer })

export function PocketIdSettings({ initial, callbackUrl }: { initial: Settings; callbackUrl: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const [settings, setSettings] = useState(withDiscoveryUrl(initial))
  const previewCallback = settings.publicUrl
    ? `${settings.publicUrl.replace(/\/$/, "")}/api/auth/callback/pocket-id`
    : callbackUrl
  const [secret, setSecret] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function submit(test: boolean) {
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch("/api/admin/pocket-id", {
        method: test ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(test ? { issuer: settings.issuer } : {
          publicUrl: settings.publicUrl, enabled: settings.enabled, issuer: settings.issuer, clientId: settings.clientId, clientSecret: secret,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(t(`pocketId.${result.error || "errorOccurred"}`))
      if (!test) {
        setSettings(withDiscoveryUrl(result)); setSecret("")
        // Changing the public origin can change secure-cookie names or their host.
        if (result.publicUrl !== initial.publicUrl) window.location.assign(`${result.publicUrl || ""}/login`)
        else router.refresh()
      }
      setNotice(t(test ? "pocketId.discoveryOk" : "pocketId.saved"))
    } catch (error) { setError(error instanceof Error ? error.message : t("pocketId.errorOccurred")) }
    finally { setBusy(false) }
  }

  return <section className="rounded-xl border bg-white p-5 sm:p-6 space-y-4">
    <h2 className="text-xl font-semibold">{t("pocketId.title")}</h2>
    <p className="text-sm text-gray-600">{t("pocketId.description")}</p>
    <p className="text-sm text-gray-600">{t("pocketId.setup")}</p>
    <div className="space-y-2">
      <Label htmlFor="pocket-id-callback">{t("pocketId.callback")}</Label>
      <Input id="pocket-id-callback" readOnly value={previewCallback} onFocus={e => e.target.select()} />
      <Button type="button" variant="outline" onClick={async () => {
        try { await navigator.clipboard.writeText(previewCallback); setNotice(t("pocketId.copied")) }
        catch { setError(t("pocketId.copyFailed")) }
      }}>{t("pocketId.copy")}</Button>
    </div>
    <form onSubmit={e => { e.preventDefault(); void submit(false) }}>
      <fieldset disabled={busy} className="space-y-4">
        <legend className="sr-only">{t("pocketId.title")}</legend>
        <div className="space-y-2">
          <Label htmlFor="public-url">{t("pocketId.publicUrl")}</Label>
          <Input id="public-url" type="url" value={settings.publicUrl} onChange={e => setSettings({ ...settings, publicUrl: e.target.value })} maxLength={2048} aria-describedby="public-url-help" />
          <p id="public-url-help" className="text-sm text-gray-600">{t("pocketId.publicUrlHelp")}</p>
          <Button type="button" variant="outline" onClick={() => setSettings({ ...settings, publicUrl: window.location.origin })}>{t("pocketId.useBrowserUrl")}</Button>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} />
          {t("pocketId.enabled")}
        </label>
        <div className="space-y-2">
          <Label htmlFor="pocket-id-issuer">{t("pocketId.issuer")}</Label>
          <Input id="pocket-id-issuer" type="url" value={settings.issuer} onChange={e => setSettings({ ...settings, issuer: e.target.value })} maxLength={2048} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pocket-id-client">{t("pocketId.clientId")}</Label>
          <Input id="pocket-id-client" value={settings.clientId} onChange={e => setSettings({ ...settings, clientId: e.target.value })} maxLength={512} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pocket-id-secret">{t("pocketId.clientSecret")}</Label>
          <Input id="pocket-id-secret" type="password" autoComplete="new-password" value={secret} onChange={e => setSecret(e.target.value)} maxLength={4096} aria-describedby="pocket-id-secret-help" />
          <p id="pocket-id-secret-help" className="text-sm text-gray-600">{t(settings.hasClientSecret ? "pocketId.secretStored" : "pocketId.secretRequired")}</p>
        </div>
        <p className="text-sm text-amber-800">{t("pocketId.trustNotice")}</p>
        <div className="flex flex-wrap gap-3">
          <Button type="submit">{t("pocketId.save")}</Button>
          <Button type="button" variant="outline" disabled={!settings.issuer} onClick={() => void submit(true)}>{t("pocketId.test")}</Button>
        </div>
      </fieldset>
    </form>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
  </section>
}
