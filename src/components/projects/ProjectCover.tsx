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
import { useState } from "react";

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("design.changeCover")}</DialogTitle>
          <DialogDescription>{t("design.coverHelp")}</DialogDescription>
        </DialogHeader>
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
