"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, ExternalLink, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProjectCover } from "./ProjectCover";
import { ProjectForm } from "./ProjectForm";

interface ProjectActionsProps {
  project: {
    shortCode: string;
    brandingImage?: string | null;
    id: string;
    name: string;
    description: string | null;
    date: Date | null;
    location: string | null;
    address: string | null;
    isPublic: boolean;
    showMoodboardPublicly: boolean;
    showParticipantsPublicly: boolean;
    showContractsPublicly: boolean;
    showSelectionPublicly: boolean;
    showSelectionFolders: boolean;
    allowSelectionDownload?: boolean;
    showCallsheetPublicly: boolean;
    showResultsPublicly: boolean;
    showAppointmentsPublicly: boolean;
    allowApplications: boolean;
    allowAppointments: boolean;
    allowGuestSelection: boolean;
    galleryLayout: string;
  };
}

export function ProjectActions({ project }: ProjectActionsProps) {
  const router = useRouter();

  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ProjectForm initialData={project} onSuccess={() => router.refresh()} />
      <ProjectCover
        projectId={project.id}
        image={project.brandingImage}
        editable
        actionOnly
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("design.projectMenu")}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${window.location.origin}/p/${project.shortCode}`,
                );
                toast.success(t("selection.copied"));
              } catch {
                toast.error(t("common.error"));
              }
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            {t("design.copyLink")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a
              href={`/p/${project.shortCode}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("design.openPublic")}
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
