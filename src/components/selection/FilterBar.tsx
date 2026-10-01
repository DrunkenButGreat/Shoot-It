"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

interface FilterBarProps {
  onFilterChange: (filterType: string, value: string | null) => void;
  activeStars?: string[];
  activeColors?: string[];
}

export function FilterBar({
  onFilterChange,
  activeStars = [],
  activeColors = [],
}: FilterBarProps) {
  const { t } = useI18n();

  return (
    <div className="">
      <div className="flex flex-wrap gap-3">
        {/* Star filters */}
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {t("selection.stars")}:
          </span>
          <div className="flex flex-wrap gap-1">
            {[1, 2, 3, 4, 5].map((stars) => {
              const isActive = activeStars.includes(stars.toString());
              return (
                <Button
                  key={stars}
                  aria-pressed={isActive}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => onFilterChange("stars", stars.toString())}
                  className="h-7 px-2 text-xs"
                >
                  {stars}
                  <Star
                    className={`h-3 w-3 ml-1 ${isActive ? "fill-current" : ""}`}
                  />
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilterChange("stars", null)}
              className="h-7 px-2 text-xs"
              disabled={activeStars.length === 0}
            >
              {t("common.clear")}
            </Button>
          </div>
        </div>

        {/* Color filters */}
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {t("selection.color")}:
          </span>
          <div className="flex flex-wrap gap-1">
            {[
              {
                id: "RED",
                label: t("selection.red"),
                bg: "bg-red-50",
                hover: "hover:bg-red-100",
                text: "text-red-700",
                border: "border-red-300",
                active: "bg-red-200 border-red-500",
              },
              {
                id: "YELLOW",
                label: t("selection.yellow"),
                bg: "bg-yellow-50",
                hover: "hover:bg-yellow-100",
                text: "text-yellow-700",
                border: "border-yellow-300",
                active: "bg-yellow-200 border-yellow-500",
              },
              {
                id: "GREEN",
                label: t("selection.green"),
                bg: "bg-green-50",
                hover: "hover:bg-green-100",
                text: "text-green-700",
                border: "border-green-300",
                active: "bg-green-200 border-green-500",
              },
            ].map((color) => {
              const isActive = activeColors.includes(color.id);
              return (
                <Button
                  key={color.id}
                  aria-pressed={isActive}
                  variant="outline"
                  size="sm"
                  onClick={() => onFilterChange("color", color.id)}
                  className={`h-8 ${color.bg} ${color.hover} ${color.text} ${color.border} ${isActive ? color.active : ""}`}
                >
                  {color.label}
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFilterChange("color", null)}
              className="h-7 px-2 text-xs"
              disabled={activeColors.length === 0}
            >
              {t("common.clear")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
