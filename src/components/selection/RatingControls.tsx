"use client";

import { useI18n } from "@/components/I18nProvider";
import { Star } from "lucide-react";
import { useProof } from "./PersonalSelection";

interface Rating {
  id: string;
  stars: number | null;
  color: string | null;
}

interface RatingControlsProps {
  projectId: string;
  imageId: string;
  initialRating?: Rating;
  disabled?: boolean;
  className?: string;
  isGuest?: boolean;
}


export function RatingControls({
  imageId, initialRating, disabled: externalDisabled, className,
}: RatingControlsProps) {
  const { t } = useI18n();
  const proof = useProof();
  const stars = initialRating?.stars ?? 0, color = initialRating?.color ?? null;
  const disabled = !!externalDisabled || !proof?.editable || proof.busy;
  const handleStarClick = (value: number) => !disabled && proof?.send({ action: 'rate', imageId, stars: stars === value ? null : value });
  const handleColorClick = (value: 'RED' | 'YELLOW' | 'GREEN') => !disabled && proof?.send({ action: 'rate', imageId, color: color === value ? null : value });

  return (
    <div
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${className || ""}`}
    >
      {/* Stars */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            aria-label={`${rating} ${t("selection.stars")}`}
            aria-pressed={rating === stars}
            onClick={() => handleStarClick(rating)}
            disabled={disabled}
            className="disabled:opacity-50 transition-all hover:scale-110"
          >
            <Star
              className={`h-4 w-4 ${
                rating <= stars
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Color labels */}
      <div className="flex items-center gap-1">
        {(["RED", "YELLOW", "GREEN"] as const).map((c) => {
          const bgColors: Record<string, string> = {
            RED:
              color === "RED"
                ? "bg-red-500 border-red-700"
                : "bg-red-200 border-red-300 hover:bg-red-300",
            YELLOW:
              color === "YELLOW"
                ? "bg-yellow-500 border-yellow-700"
                : "bg-yellow-200 border-yellow-300 hover:bg-yellow-300",
            GREEN:
              color === "GREEN"
                ? "bg-green-500 border-green-700"
                : "bg-green-200 border-green-300 hover:bg-green-300",
          };
          return (
            <button
              key={c}
              aria-label={t(`selection.${c.toLowerCase()}`)}
              aria-pressed={color === c}
              onClick={() => handleColorClick(c)}
              disabled={disabled}
              className={`w-3.5 h-3.5 rounded-full border-2 ${bgColors[c]} disabled:opacity-50 transition-all hover:scale-110`}
            />
          );
        })}
      </div>
    </div>
  );
}
