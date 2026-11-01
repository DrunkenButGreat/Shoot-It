"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImagePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function ProjectCover({
  projectId,
  image,
  editable = false,
  actionOnly = false,
  positionX = 50,
  positionY = 50,
}: {
  projectId: string;
  image?: string | null;
  editable?: boolean;
  actionOnly?: boolean;
  positionX?: number;
  positionY?: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [x, setX] = useState(positionX);
  const [y, setY] = useState(positionY);
  const drag = useRef<{ startX: number; startY: number; x: number; y: number; overflowX: number; overflowY: number } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { setX(positionX); setY(positionY); }, [positionX, positionY, open]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [source, setSource] = useState<'upload' | 'moodboard' | 'selection' | 'results'>('upload');
  const [page, setPage] = useState(0);
  const [images, setImages] = useState<Array<{ id: string; filename: string; path: string; thumbnail: string | null }>>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || source === 'upload') return;
    const controller = new AbortController();
    setLoading(true); setImages([]); setError('');
    void fetch(`/api/projects/${projectId}/branding?source=${source}&page=${page}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) { setImages(data.images); setHasMore(data.hasMore); }
      }).catch(() => { if (!controller.signal.aborted) setError(t('common.error')); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, source, page, projectId, t]);
  const updateCover = async (remove = false) => {
    if (busy || (remove && !confirm(t('coverControls.removeConfirm')))) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/projects/${projectId}/branding`, remove ? { method: 'DELETE' } : {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'position', x, y }),
      });
      if (!response.ok) throw new Error();
      setOpen(false); router.refresh();
    } catch { setError(t('common.error')); }
    finally { setBusy(false); }
  };
  const choose = async (imageId: string) => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/projects/${projectId}/branding`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, imageId }),
      });
      if (!response.ok) throw new Error();
      setOpen(false); router.refresh();
    } catch { setError(t('common.error')); }
    finally { setBusy(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)
        throw new Error(t("design.coverHelp"));
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/projects/${projectId}/branding`, {
        method: "POST",
        body,
      });
      if (!response.ok) throw new Error(t("common.error"));
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };
  const action = editable && (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-white">
          <ImagePlus className="h-4 w-4" />
          {t("design.changeCover")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("design.changeCover")}</DialogTitle>
          <DialogDescription>{t("design.coverHelp")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {(['upload', 'moodboard', 'selection', 'results'] as const).map(item => (
            <Button key={item} size="sm" variant={source === item ? 'secondary' : 'ghost'} disabled={busy}
              aria-pressed={source === item} onClick={() => { setSource(item); setPage(0); }}>
              {t(item === 'upload' ? 'appearance.upload' : `project.${item}`)}
            </Button>
          ))}
        </div>
        {image && <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t('coverControls.position')}</h3>
          <p className="text-sm text-slate-500">{t('coverControls.help')}</p>
          <img src={image} alt={t('design.projectCover')} draggable={false}
            className="aspect-[16/7] w-full touch-none cursor-move select-none rounded-lg object-cover"
            style={{ objectPosition: `${x}% ${y}%` }}
            onPointerDown={e => {
              if (busy) return;
              const el = e.currentTarget, rect = el.getBoundingClientRect();
              const scale = Math.max(rect.width / el.naturalWidth, rect.height / el.naturalHeight);
              drag.current = { startX: e.clientX, startY: e.clientY, x, y, overflowX: el.naturalWidth * scale - rect.width, overflowY: el.naturalHeight * scale - rect.height };
              el.setPointerCapture(e.pointerId);
            }}
            onPointerMove={e => {
              const d = drag.current; if (!d) return;
              const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)));
              if (d.overflowX > 1) setX(clamp(d.x - (e.clientX - d.startX) / d.overflowX * 100));
              if (d.overflowY > 1) setY(clamp(d.y - (e.clientY - d.startY) / d.overflowY * 100));
            }}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{t('coverControls.horizontal')}
              <input className="block w-full" type="range" min="0" max="100" value={x} disabled={busy} onChange={e => setX(Number(e.target.value))} />
            </label>
            <label className="text-sm">{t('coverControls.vertical')}
              <input className="block w-full" type="range" min="0" max="100" value={y} disabled={busy} onChange={e => setY(Number(e.target.value))} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void updateCover()}>{t('coverControls.save')}</Button>
            <Button variant="outline" className="text-red-600" disabled={busy} onClick={() => void updateCover(true)}>{t('coverControls.remove')}</Button>
          </div>
        </div>}
        {source === 'upload' ? <>
        <input
          aria-label={t("design.changeCover")}
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => {
            void upload(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="w-full rounded-lg border p-3 text-sm file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:p-2 file:text-blue-700"
        />
        </> : <>
          <p className="text-sm text-slate-500">{t('appearance.chooseCover')}</p>
          {loading ? <p role="status">{t('common.loading')}</p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map(item => <button key={item.id} disabled={busy} onClick={() => void choose(item.id)}
              aria-label={`${t('appearance.useCover')}: ${item.filename}`} className="overflow-hidden rounded-lg border text-left hover:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">
              <img src={item.thumbnail || item.path} alt="" className="aspect-video w-full object-cover" loading="lazy" />
              <span className="block truncate p-2 text-xs">{item.filename}</span>
            </button>)}
          </div>}
          {!loading && images.length === 0 && <p>{t('common.noImages')}</p>}
          <div className="flex justify-between gap-2">
            <Button variant="outline" disabled={busy || loading || page === 0} onClick={() => setPage(page - 1)}>{t('appearance.previous')}</Button>
            <Button variant="outline" disabled={busy || loading || !hasMore} onClick={() => setPage(page + 1)}>{t('appearance.next')}</Button>
          </div>
        </>}
        {busy && <Loader2 className="h-5 w-5 animate-spin" />}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
  if (actionOnly) return action;
  return (
    <div className="relative aspect-[16/7] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      {image ? (
        <img
          src={image}
          alt={t("design.projectCover")}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: `${positionX}% ${positionY}%` }}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-slate-400">
          <ImagePlus className="h-12 w-12" />
        </div>
      )}
      {editable && <div className="absolute bottom-3 right-3">{action}</div>}
    </div>
  );
}
