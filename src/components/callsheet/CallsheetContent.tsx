"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, Info, MapPin, Plus, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ScheduleForm } from "./ScheduleForm";

type Callsheet = {
  id: string;
  locationName: string | null;
  locationAddress: string | null;
  callTime: Date | string | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  wrapTime?: Date | string | null;
  additionalNotes: string | null;
  scheduleItems: {
    id: string;
    time: string;
    activity: string;
    notes?: string | null;
  }[];
} | null;

export function CallsheetContent({
  projectId,
  initialCallsheet,
}: {
  projectId: string;
  initialCallsheet: Callsheet;
}) {
  const [editing, setEditing] = useState(false);
  const [callsheet, setCallsheet] = useState(initialCallsheet);
  const [shootDate, setShootDate] = useState(
    initialCallsheet?.callTime
      ? new Date(
          new Date(initialCallsheet.callTime).getTime() -
            new Date(initialCallsheet.callTime).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .split("T")[0]
      : "",
  );
  const [location, setLocation] = useState(
    initialCallsheet?.locationName || "",
  );
  const [callTime, setCallTime] = useState(
    initialCallsheet?.callTime
      ? new Date(initialCallsheet.callTime).toTimeString().substring(0, 5)
      : "",
  );
  const [notes, setNotes] = useState(initialCallsheet?.additionalNotes || "");
  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { t, locale } = useI18n();

  const refreshCallsheet = async () => {
    const response = await fetch(`/api/projects/${projectId}/callsheet`);
    if (response.ok) {
      const data = await response.json();
      setCallsheet(data.callsheet);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/callsheet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          locationName: location,
          callTime:
            shootDate && callTime
              ? new Date(`${shootDate}T${callTime}`).toISOString()
              : undefined,
          additionalNotes: notes,
        }),
      });

      if (response.ok) {
        await refreshCallsheet();
        setEditing(false);
      } else {
        throw new Error();
      }
    } catch (error) {
      toast.error(t("common.error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="studio-page-title">{t("callsheet.title")}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {t("callsheet.subtitle")}
          </p>
        </div>
        <Button
          onClick={() => setEditing(true)}
          disabled={isSaving}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {t("common.edit")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["call", "start", "end", "wrap"] as const).map((key) => {
          const value = callsheet?.[`${key}Time`];
          return (
            <div key={key} className="studio-panel p-4">
              <p className="text-xs text-slate-500">{t(`callsheet.${key}`)}</p>
              <p className="mt-2 text-xl font-semibold">
                {value
                  ? new Date(value).toLocaleTimeString(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </p>
            </div>
          );
        })}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <aside className="space-y-4 xl:order-2">
          <section className="studio-panel p-5">
            <h2 className="mb-4 text-sm font-semibold">
              {t("callsheet.location")}
            </h2>
            <p className="text-sm">
              {callsheet?.locationName || t("common.tbd")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {callsheet?.locationAddress}
            </p>
          </section>
          <section className="studio-panel p-5">
            <h2 className="mb-4 text-sm font-semibold">
              {t("callsheet.notesTitle")}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-500">
              {callsheet?.additionalNotes || "—"}
            </p>
          </section>
        </aside>
        {/* Right Column: Schedule */}
        <div className="min-w-0 xl:order-1">
          <Card className="h-full overflow-hidden bg-white">
            <CardHeader className="border-b border-slate-200 bg-slate-50 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  {t("callsheet.schedule")}
                </CardTitle>
                <Button
                  onClick={() => setIsScheduleFormOpen(true)}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  <Plus className="h-3 w-3" />
                  {t("callsheet.addItem")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {callsheet?.scheduleItems &&
              callsheet.scheduleItems.length > 0 ? (
                <div className="space-y-3">
                  {callsheet.scheduleItems.map((item) => (
                    <div
                      key={item.id}
                      className="group border-b border-slate-100 py-5 last:border-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                          {new Date(item.time).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                          {item.activity}
                          {item.notes && <p className="mt-1 whitespace-pre-wrap text-sm font-normal text-slate-500">{item.notes}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
                  <p className="font-medium text-slate-500">
                    {t("callsheet.noItems")}
                  </p>
                  <Button
                    onClick={() => setIsScheduleFormOpen(true)}
                    variant="link"
                    className="mt-2 text-blue-600 font-bold"
                  >
                    {t("callsheet.createFirst")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("callsheet.details")}</DialogTitle>
            <DialogDescription>{t("callsheet.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label
                htmlFor="shootDate"
                className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2"
              >
                <Calendar className="h-3 w-3" />
                {t("callsheet.date")}
              </Label>
              <Input
                id="shootDate"
                type="date"
                value={shootDate}
                onChange={(e) => setShootDate(e.target.value)}
                className="rounded-xl border-slate-200"
              />
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="location"
                className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2"
              >
                <MapPin className="h-3 w-3" />
                {t("callsheet.location")}
              </Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("callsheet.location")}
                className="rounded-xl border-slate-200"
              />
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="callTime"
                className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2"
              >
                <Clock className="h-3 w-3" />
                {t("callsheet.call")}
              </Label>
              <Input
                id="callTime"
                type="time"
                value={callTime}
                onChange={(e) => setCallTime(e.target.value)}
                placeholder="09:00"
                className="rounded-xl border-slate-200"
              />
            </div>
            <div className="grid gap-2">
              <Label
                htmlFor="notes"
                className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2"
              >
                <Info className="h-3 w-3" />
                {t("callsheet.notesTitle")}
              </Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("callsheet.notesPlaceholder")}
                className="w-full min-h-[120px] px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </DialogContent>
      </Dialog>
      <ScheduleForm
        projectId={projectId}
        isOpen={isScheduleFormOpen}
        onClose={() => setIsScheduleFormOpen(false)}
        onSuccess={() => {
          setIsScheduleFormOpen(false);
          refreshCallsheet();
        }}
      />
    </div>
  );
}
