"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Mail, MoreHorizontal, Phone, Trash2, User } from "lucide-react";
import { useState } from "react";

interface Participant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  notes: string | null;
  images: any[];
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface ParticipantCardProps {
  participant: Participant;
  projectId: string;
  onDelete?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  list?: boolean;
}

export function ParticipantCard({
  participant,
  projectId,
  onDelete,
  onSelect,
  selected,
  list,
}: ParticipantCardProps) {
  const { t } = useI18n();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (
      !confirm(
        t("participants.deleteConfirm").replace("{name}", participant.name),
      )
    ) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/participants/${participant.id}`,
        { method: "DELETE" },
      );

      if (response.ok) {
        onDelete?.();
      } else {
        alert(t("participants.deleteError"));
      }
    } catch (error) {
      alert(t("auth.errorOccurred"));
    } finally {
      setIsDeleting(false);
    }
  };

  const portrait =
    participant.images[0]?.thumbnail ||
    participant.images[0]?.path ||
    participant.user?.image;
  return (
    <Card
      className={`relative overflow-hidden bg-white ${selected ? "border-blue-600 ring-1 ring-blue-600" : ""} ${list ? "flex items-center" : ""}`}
    >
      <button
        onClick={onSelect}
        className={`block text-left ${list ? "flex min-w-0 flex-1 items-center gap-4" : "w-full"}`}
        aria-label={`${t("common.details")}: ${participant.name}`}
      >
        <div
          className={`${list ? "h-20 w-24 shrink-0" : "aspect-[4/3] w-full"} overflow-hidden bg-slate-100`}
        >
          {portrait ? (
            <img src={portrait} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400">
              <User className="h-10 w-10" />
            </div>
          )}
        </div>
        <div className="min-w-0 p-3 pb-2">
          <h3 className="truncate text-sm font-semibold">{participant.name}</h3>
          <p className="mt-1 text-xs text-slate-500">{participant.role}</p>
        </div>
      </button>
      {!participant.id.startsWith("owner-") && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t("common.actions")}: ${participant.name}`}
              className="absolute right-2 top-2 h-7 w-7 rounded-full bg-white"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onSelect}>
              {t("participants.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handleDelete}
              disabled={isDeleting}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div
        className={`space-y-2 p-3 pt-0 ${list ? "hidden w-64 shrink-0 pr-10 lg:block" : ""}`}
      >
        {participant.email && (
          <a
            href={`mailto:${participant.email}`}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600"
          >
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{participant.email}</span>
          </a>
        )}
        {participant.phone && (
          <a
            href={`tel:${participant.phone}`}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-blue-600"
          >
            <Phone className="h-3.5 w-3.5 shrink-0" />
            {participant.phone}
          </a>
        )}
      </div>
    </Card>
  );
}
