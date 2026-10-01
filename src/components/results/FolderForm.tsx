"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";

type Folder = {
  id: string;
  name: string;
};

export function FolderForm({
  projectId,
  folders,
  isOpen,
  onClose,
  onSuccess,
  defaultParentId,
}: {
  projectId: string;
  folders: Folder[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultParentId?: string | null;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  useEffect(() => {
    if (isOpen) setParentId(defaultParentId || "");
  }, [isOpen, defaultParentId]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/results/folders`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            parentId: parentId || null,
          }),
        },
      );

      if (response.ok) {
        setName("");
        setParentId("");
        onSuccess();
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("results.addFolder")}</DialogTitle>
          <DialogDescription>
            {t("results.addFolderDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t("results.folderName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="..."
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="parent">{t("results.parentFolder")}</Label>
              <select
                id="parent"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">-- {t("results.rootLevel")} --</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
