"use client";

import { useId } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useGallerySize } from "@/components/GallerySizeProvider";

export function GallerySizeControl() {
  const id = useId();
  const { t } = useI18n();
  const { size, setSize } = useGallerySize();

  return (
    <div className="flex min-h-11 max-w-full flex-wrap items-center gap-x-3 text-sm text-slate-600">
      <label htmlFor={id}>{t("common.imageSize")}</label>
      <input
        id={id}
        type="range"
        min={75}
        max={200}
        step={5}
        value={size}
        aria-valuetext={`${size} %`}
        onChange={(event) => setSize(Number(event.target.value))}
        className="h-11 w-28 max-w-full cursor-pointer accent-blue-600"
      />
      <output htmlFor={id} className="w-12 tabular-nums">{size} %</output>
    </div>
  );
}
