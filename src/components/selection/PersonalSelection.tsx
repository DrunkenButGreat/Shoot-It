"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Heart } from 'lucide-react'
import { useI18n } from '@/components/I18nProvider'
import { Button } from '@/components/ui/button'

type Note = { id: string; imageId: string; text: string; done: boolean }
type List = { id: string; name: string; submittedAt: string | null; picks: { imageId: string }[]; notes: Note[] }
type State = { mine: List | null; lists: List[]; guest: boolean; editor: boolean; target: number | null; due: string | null }
type Command = { action: 'pick'; imageId: string; value: boolean } | { action: 'note'; imageId: string; text: string } | { action: 'submit'; name: string } | { action: 'resolve'; noteId: string; done: boolean } | { action: 'reopen'; listId: string } | { action: 'settings'; target: number | null; due: string | null }
type Proof = { state: State; picks: Set<string>; busy: boolean; send: (command: Command) => Promise<boolean>; filter: Set<string> | null; view: string; setView: (value: string) => void }
const Context = createContext<Proof | null>(null)
export const useProofFilter = () => useContext(Context)?.filter

export function PersonalSelection({ projectId, children }: { projectId: string; children: ReactNode }) {
  const { t } = useI18n()
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState('all')
  const pending = useRef(false)
  const url = `/api/projects/${projectId}/proof`
  const fetchState = useCallback(async (signal?: AbortSignal): Promise<State> => {
    const result = await fetch(url, { cache: 'no-store', signal })
    if (!result.ok) throw Error('failed')
    return result.json()
  }, [url])
  const load = () => fetchState().then(setState)
  useEffect(() => {
    const controller = new AbortController()
    fetchState(controller.signal).then(next => { if (!controller.signal.aborted) setState(next) }).catch(() => { if (!controller.signal.aborted) setError('failed') })
    return () => controller.abort()
  }, [fetchState])
  async function send(command: Command) {
    if (pending.current) return false
    pending.current = true; setBusy(true); setError('')
    try {
      const result = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) })
      if (!result.ok) { setError((await result.json()).error || 'failed'); await load(); return false }
      await load(); return true
    } catch { setError('failed'); return false }
    finally { pending.current = false; setBusy(false) }
  }
  const picks = useMemo(() => new Set(state?.mine?.picks.map(p => p.imageId)), [state])
  const filter = useMemo(() => {
    if (view === 'all') return null
    if (view === 'mine') return picks
    if (view === 'overlap') {
      const seen = new Set<string>(), overlap = new Set<string>()
      for (const list of state?.lists ?? []) for (const { imageId } of list.picks) { if (seen.has(imageId)) overlap.add(imageId); seen.add(imageId) }
      return overlap
    }
    return new Set(state?.lists.find(list => list.id === view)?.picks.map(p => p.imageId))
  }, [view, state, picks])
  return <Context.Provider value={state ? { state, picks, filter, view, setView, busy, send } : null}>
    {error && <div role="alert" className="rounded border p-3 text-red-800">{t(`proof.${error}`)} <button type="button" className="underline" onClick={() => load().then(() => setError('')).catch(() => setError('failed'))}>{t('proof.reload')}</button></div>}
    {children}
  </Context.Provider>
}

export function ProofToolbar() {
  const proof = useContext(Context)
  const { t, locale } = useI18n()
  const [name, setName] = useState('')
  if (!proof) return null
  const { state, picks, view, setView, busy, send } = proof
  const listName = (list: List) => list.name || `${t('proof.guest')} · ${list.id.slice(-6)}`
  return <section className="studio-panel space-y-3 p-4 text-slate-900" aria-label={t('proof.title')}>
    <h3 className="font-semibold">{t('proof.title')}</h3>
    <p className="text-sm text-slate-600">{t('proof.hint')}{state.guest && ` ${t('proof.browser')}`}</p>
    <div className="flex flex-wrap items-center gap-3">
      <strong aria-live="polite">{picks.size}{state.target && ` / ${state.target}`} {t('proof.picked')}</strong>
      {state.due && <span>{t('proof.due')}: {new Date(`${state.due}T12:00:00`).toLocaleDateString(locale)}</span>}
      {state.mine?.submittedAt ? <span>{t('proof.submitted')} · {new Date(state.mine.submittedAt).toLocaleString(locale)}</span> : <>
        {state.guest && <input className="rounded border p-2" aria-label={t('proof.name')} placeholder={t('proof.name')} maxLength={100} value={name} onChange={e => setName(e.target.value)} />}
        <Button disabled={busy || !picks.size || (!!state.target && state.target !== picks.size) || (state.guest && !name.trim())} onClick={() => { if (confirm(t('proof.confirm'))) void send({ action: 'submit', name }) }}>{t('proof.submit')}</Button>
      </>}
      <label>{t('proof.show')} <select className="rounded border p-2" value={view} onChange={e => setView(e.target.value)}>
        <option value="all">{t('proof.all')}</option><option value="mine">{t('proof.mine')}</option>
        {state.editor && <option value="overlap">{t('proof.overlap')}</option>}
        {state.lists.filter(list => list.id !== state.mine?.id).map(list => <option key={list.id} value={list.id}>{listName(list)}</option>)}
      </select></label>
    </div>
    {state.editor && <details><summary className="cursor-pointer">{t('proof.manage')}</summary>
      <form key={`${state.target}/${state.due}`} className="my-3 flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault(); const data = new FormData(event.currentTarget)
        void send({ action: 'settings', target: Number(data.get('target')) || null, due: String(data.get('due')) || null })
      }}>
        <label>{t('proof.target')} <input className="w-24 rounded border p-2" type="number" min="1" max="100000" name="target" defaultValue={state.target ?? ''} /></label>
        <label>{t('proof.due')} <input className="rounded border p-2" type="date" name="due" defaultValue={state.due ?? ''} /></label>
        <Button variant="outline" disabled={busy}>{t('common.save')}</Button>
      </form>
      {state.lists.map(list => <div key={list.id} className="flex flex-wrap items-center gap-3 border-t py-2"><button type="button" className="underline" onClick={() => setView(list.id === state.mine?.id ? 'mine' : list.id)}>{listName(list)} ({list.picks.length})</button>
        <span>{t(list.submittedAt ? 'proof.submitted' : 'proof.draft')}</span>
        {list.submittedAt && <Button variant="outline" size="sm" disabled={busy} onClick={() => send({ action: 'reopen', listId: list.id })}>{t('proof.reopen')}</Button>}
      </div>)}
    </details>}
  </section>
}

export function ProofHeart({ imageId }: { imageId: string }) {
  const proof = useContext(Context), { t } = useI18n()
  if (!proof) return null
  const checked = proof.picks.has(imageId)
  return <button type="button" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded text-rose-600" aria-pressed={checked} aria-label={t('proof.favorite')} title={t('proof.favorite')} disabled={proof.busy || !!proof.state.mine?.submittedAt} onClick={event => { event.stopPropagation(); void proof.send({ action: 'pick', imageId, value: !checked }) }}><Heart size={20} fill={checked ? 'currentColor' : 'none'} /></button>
}

export function ProofFeedback({ imageId }: { imageId: string }) {
  const proof = useContext(Context), { t } = useI18n()
  const [text, setText] = useState('')
  if (!proof) return null
  const { state, busy, send } = proof
  const lists = state.editor ? state.lists : state.mine ? [state.mine] : []
  const notes = lists.flatMap(list => list.notes.filter(note => note.imageId === imageId).map(note => ({ ...note, name: list.name })))
  return <div className="mt-2 max-h-[28vh] overflow-auto rounded bg-white px-3 text-sm text-slate-900" onKeyDown={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <details><summary className="cursor-pointer py-2">{t('proof.feedback')} ({notes.length})</summary>
      {notes.map(note => <div key={note.id} className="border-t py-1"><strong>{note.name || t('proof.guest')}</strong>: <span className={note.done ? 'line-through' : ''}>{note.text}</span> {state.editor ? <label><input type="checkbox" checked={note.done} disabled={busy} onChange={e => send({ action: 'resolve', noteId: note.id, done: e.target.checked })} /> {t('proof.done')}</label> : note.done && t('proof.done')}</div>)}
      {!state.mine?.submittedAt && <form className="flex gap-2 py-2" onSubmit={async event => { event.preventDefault(); if (await send({ action: 'note', imageId, text })) setText('') }}>
        <input className="min-w-0 flex-1 rounded border p-2" aria-label={t('proof.feedback')} placeholder={t('proof.note')} maxLength={2000} required value={text} onChange={e => setText(e.target.value)} />
        <Button disabled={busy || !text.trim()}>{t('common.save')}</Button>
      </form>}
    </details>
  </div>
}
