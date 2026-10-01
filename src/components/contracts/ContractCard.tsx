"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, FileText, Trash2 } from "lucide-react";
import { useState } from "react";

type Contract = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  signatures: {
    id: string;
    signedAt: Date;
  }[];
};

export function ContractCard({
  contract,
  projectId,
  onDelete,
}: {
  contract: Contract;
  projectId: string;
  onDelete: () => void;
}) {
  const { t, locale } = useI18n();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/contracts/${contract.id}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        onDelete();
        setShowDeleteDialog(false);
      }
    } catch (error) {
      console.error("Failed to delete contract:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const isSigned = contract.signatures.length > 0;

  return (
    <>
      <Card className="group overflow-hidden bg-white transition-colors hover:border-slate-300">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                <FileText className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {contract.title}
                </CardTitle>
                <CardDescription className="flex items-center gap-1.5 mt-1">
                  {t("contracts.created")}:{" "}
                  {new Date(contract.createdAt).toLocaleDateString(locale)}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSigned && (
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {t("contracts.signed")}
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeleting}
                className="hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="prose max-w-none pt-2 border-t border-gray-50">
            <p className="min-h-80 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {contract.content}
            </p>
          </div>
          {isSigned && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] font-medium text-slate-500">
              {t("contracts.lastSigned")}{" "}
              {new Date(contract.signatures[0].signedAt).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("contracts.deleteContract")}</DialogTitle>
            <DialogDescription>
              {t("common.deleteConfirm")} ("{contract.title}")
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? t("common.loading") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
