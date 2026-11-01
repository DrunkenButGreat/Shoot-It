"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { isIOSDevice } from "@/lib/ios-device";

export function useIOSDevice() {
  const [isIOS, setIsIOS] = useState(false);
  useEffect(() => { setIsIOS(isIOSDevice(navigator)); }, []);
  return isIOS;
}

export type OriginalImage = { path: string; isVideo?: boolean };

/** Open the original as an inline image so iOS can offer its native save action. */
export function OriginalImageButton({ image, allowed = true }: {
  image?: OriginalImage;
  allowed?: boolean;
}) {
  const isIOS = useIOSDevice();
  const { t } = useI18n();
  if (!isIOS || !allowed || !image || image.isVideo) return null;
  return (
    <a
      href={image.path}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/30 bg-black/60 px-3 py-2 text-sm font-semibold text-white hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {t("design.originalDownload")}
    </a>
  );
}
