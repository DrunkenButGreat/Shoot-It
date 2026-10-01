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
import { useEffect, useState } from "react";

export function ProjectCover({
  projectId,
  image,
  editable = false,
  actionOnly = false,
}: {
  projectId: string;
  image?: string | null;
  editable?: boolean;
  actionOnly?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
        {source === 'upload' ? <>
        {image && (
          <img
            src={image}
            alt={t("design.projectCover")}
            className="aspect-video w-full rounded-lg object-cover"
          />
        )}
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
