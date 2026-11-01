"use client";

import { useI18n } from "@/components/I18nProvider";
import type { SelectionSort } from "@/lib/selection-sort";

export function SelectionSortControl({ value, onChange }: { value: SelectionSort; onChange: (value: SelectionSort) => void }) {
  const { t } = useI18n();
  return (
    <select aria-label={t("common.sortBy")} value={value} onChange={event => onChange(event.target.value as SelectionSort)} className="h-11 max-w-full rounded-md border bg-white px-2 text-sm">
      <option value="imported">{t("common.sortNewest")}</option>
      <option value="name">{t("common.sortAlphabetical")}</option>
      <option value="captured-asc">{t("common.sortCapturedAsc")}</option>
      <option value="captured-desc">{t("common.sortCapturedDesc")}</option>
    </select>
  );
}
