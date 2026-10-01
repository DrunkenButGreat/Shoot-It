'use client'

import { useState } from 'react'
import { useI18n } from '@/components/I18nProvider'
import { Button } from '@/components/ui/button'

type Images = { landingImage: string; loginImage: string; signupImage: string }

export function SiteAppearance({ initialImages }: { initialImages: Images }) {
  const { t } = useI18n()
  const [images, setImages] = useState(initialImages)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const save = async (slot: keyof Images, file?: File) => {
    setBusy(slot); setError(''); setSaved(false)
    try {
      const body = new FormData()
      body.set('slot', slot)
      if (file) body.set('file', file)
      const response = await fetch('/api/admin/appearance', file
        ? { method: 'POST', body }
        : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slot }) })
      if (!response.ok) throw new Error()
      setImages(await response.json())
      setSaved(true)
    } catch { setError(t('common.error')) }
    finally { setBusy(null) }
  }
  return (
    <section className="studio-panel p-5 sm:p-6 space-y-4">
      <div><h2 className="text-xl font-semibold">{t('appearance.title')}</h2><p className="mt-1 text-sm text-slate-500">{t('appearance.help')}</p></div>
      <div className="grid gap-5 md:grid-cols-3">
        {(Object.keys(images) as (keyof Images)[]).map(slot => (
          <div key={slot} className="min-w-0 space-y-3">
            <label htmlFor={slot} className="block font-medium">{t(`appearance.${slot}`)}</label>
            <img src={images[slot]} alt={t(`appearance.${slot}`)} className="aspect-video w-full rounded-lg object-cover" />
            <input id={slot} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/tiff,image/heic" disabled={!!busy}
              className="w-full text-sm file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:p-2 file:text-blue-700"
              onChange={e => { const file = e.target.files?.[0]; if (file) void save(slot, file); e.target.value = '' }} />
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void save(slot)}>{t('appearance.reset')}</Button>
          </div>
        ))}
      </div>
      {busy && <p role="status">{t('common.saving')}</p>}
      {saved && <p role="status" className="text-sm text-green-700">{t('appearance.saved')}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  )
}
