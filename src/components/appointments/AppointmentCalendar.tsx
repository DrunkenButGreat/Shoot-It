"use client";

import { useI18n } from "@/components/I18nProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import deLocale from "@fullcalendar/core/locales/de";
import enLocale from "@fullcalendar/core/locales/en-gb";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { AppointmentStatus } from "@prisma/client";
import { Check, Clock, Trash2, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Slot {
  id: string;
  startTime: string;
  endTime: string;
  color: string | null;
  responses: Response[];
}

interface Response {
  id: string;
  userId: string;
  status: AppointmentStatus;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
}

interface AppointmentCalendarProps {
  projectId: string;
  isOwner: boolean;
  currentUserId: string;
}

export function AppointmentCalendar({
  projectId,
  isOwner,
  currentUserId,
}: AppointmentCalendarProps) {
  const { dictionary: dict, locale, t } = useI18n();
  const [view, setView] = useState("voting");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);

  const fetchSlots = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/appointments`);
      if (response.ok) {
        const data = await response.json();
        setSlots(data);
      }
    } catch (error) {
      console.error("Failed to fetch slots:", error);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleDateSelect = async (selectInfo: any) => {
    if (!isOwner) return;

    const calendarApi = selectInfo.view.calendar;
    calendarApi.unselect();

    try {
      const response = await fetch(`/api/projects/${projectId}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: selectInfo.startStr,
          endTime: selectInfo.endStr,
          color: null,
        }),
      });

      if (response.ok) {
        fetchSlots();
      }
    } catch (error) {
      console.error("Failed to create slot:", error);
    }
  };

  const handleEventClick = (clickInfo: any) => {
    const slot = slots.find((s) => s.id === clickInfo.event.id);
    if (slot) {
      setSelectedSlot(slot);
      setIsDialogOpen(true);
    }
  };

  const handleEventChange = async (changeInfo: any) => {
    if (!isOwner) {
      changeInfo.revert();
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/appointments/${changeInfo.event.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startTime: changeInfo.event.startStr,
            endTime: changeInfo.event.endStr,
          }),
        },
      );

      if (response.ok) {
        fetchSlots();
      } else {
        changeInfo.revert();
      }
    } catch (error) {
      console.error("Failed to update slot:", error);
      changeInfo.revert();
    }
  };

  const handleDeleteSlot = async (id?: string) => {
    const targetId = id || selectedSlot?.id;
    if (!targetId || !isOwner) return;

    if (!confirm(dict.common.deleteConfirm)) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/appointments/${targetId}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        if (!id) {
          setIsDialogOpen(false);
          setSelectedSlot(null);
        }
        fetchSlots();
      }
    } catch (error) {
      console.error("Failed to delete slot:", error);
    }
  };

  const handleRespond = async (status: AppointmentStatus, id?: string) => {
    const targetId = id || selectedSlot?.id;
    if (!targetId) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/appointments/${targetId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );

      if (response.ok) {
        fetchSlots();

        if (!id && selectedSlot) {
          // Update current selected slot state for UI responsiveness
          setSelectedSlot((prev) => {
            if (!prev) return null;
            const existingIdx = prev.responses.findIndex(
              (r) => r.userId === currentUserId,
            );
            const newResponses = [...prev.responses];
            if (existingIdx >= 0) {
              newResponses[existingIdx] = {
                ...newResponses[existingIdx],
                status,
              };
            } else {
              fetchSlots(); // Refresh to get the user object
            }
            return { ...prev, responses: newResponses };
          });
        }
      }
    } catch (error) {
      console.error("Failed to respond:", error);
    }
  };

  const renderEventContent = (eventInfo: any) => {
    const responses = eventInfo.event.extendedProps.responses || [];
    const acceptedCount = responses.filter(
      (r: any) => r.status === "ACCEPTED",
    ).length;
    const rejectedCount = responses.filter(
      (r: any) => r.status === "REJECTED",
    ).length;
    const isList = eventInfo.view.type.includes("list");

    return (
      <div
        className={`w-full h-full flex ${isList ? "flex-row items-center gap-6 py-2 px-6" : "flex-col p-1.5"}`}
      >
        {/* Voting Buttons / Info on the left in list view */}
        <div
          className={`flex items-center gap-3 ${isList ? "shrink-0" : "mt-auto"}`}
        >
          <div
            className="flex items-center gap-2 bg-green-500/10 text-green-700 px-2 py-1 rounded-lg border border-green-500/20 text-xs font-bold cursor-pointer hover:bg-green-500/20"
            onClick={(e) => {
              e.stopPropagation();
              handleRespond("ACCEPTED", eventInfo.event.id);
            }}
            title={dict.common.accept}
          >
            <Check className="h-4 w-4" />
            <span>{acceptedCount}</span>
          </div>
          <div
            className="flex items-center gap-2 bg-red-500/10 text-red-700 px-2 py-1 rounded-lg border border-red-500/20 text-xs font-bold cursor-pointer hover:bg-red-500/20"
            onClick={(e) => {
              e.stopPropagation();
              handleRespond("REJECTED", eventInfo.event.id);
            }}
            title={dict.common.reject}
          >
            <X className="h-4 w-4" />
            <span>{rejectedCount}</span>
          </div>

          {/* Delete button for Owner (left in list view) */}
          {isOwner && isList && (
            <div
              className="p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors cursor-pointer text-red-500 bg-white/50"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSlot(eventInfo.event.id);
              }}
              title={dict.common.delete}
            >
              <Trash2 className="h-4 w-4" />
            </div>
          )}
        </div>

        {isList && (
          <div className="flex-1 font-bold text-base text-gray-900">
            {eventInfo.timeText}
          </div>
        )}

        {/* Delete button for Owner (top-right in calendar view) */}
        {isOwner && !isList && (
          <div
            className="absolute top-1.5 right-1.5 p-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors cursor-pointer text-red-500 bg-white/50"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteSlot(eventInfo.event.id);
            }}
            title={dict.common.delete}
          >
            <Trash2 className="h-4 w-4" />
          </div>
        )}
      </div>
    );
  };

  const events = slots.map((slot) => ({
    id: slot.id,
    start: slot.startTime,
    end: slot.endTime,
    title: "", // No title needed as per requirements
    backgroundColor: "hsl(var(--primary) / 0.15)",
    borderColor: "hsl(var(--primary))",
    textColor: "hsl(var(--primary))",
    extendedProps: {
      responses: slot.responses,
    },
  }));

  const currentUserResponse = selectedSlot?.responses.find(
    (r) => r.userId === currentUserId,
  )?.status;

  const people = [
    ...new Map(
      slots.flatMap((slot) =>
        slot.responses.map(
          (response) => [response.userId, response.user] as const,
        ),
      ),
    ).values(),
  ];
  const createDate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!starts || !ends || new Date(ends) <= new Date(starts)) {
      toast.error(t("design.dateRangeError"));
      return;
    }
    setCreating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: new Date(starts).toISOString(),
          endTime: new Date(ends).toISOString(),
          color: null,
        }),
      });
      if (!response.ok) throw new Error();
      await fetchSlots();
      setCreateOpen(false);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setCreating(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="studio-page-title">{dict.project.appointments}</h1>
          <p className="studio-page-subtitle">
            {dict.project.appointmentsDescription}
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setCreateOpen(true)}>
            {t("design.proposeDate")}
          </Button>
        )}
      </div>
      <div className="flex gap-2 border-b">
        {["voting", "calendar"].map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className={`border-b-2 px-4 py-3 text-sm ${view === tab ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}
          >
            {t(`design.${tab}`)}
          </button>
        ))}
      </div>
      {view === "voting" && (
        <section className="studio-panel overflow-hidden p-4">
          <h2 className="mb-4 text-sm font-semibold">
            {t("design.availability")}
          </h2>
          {slots.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th className="min-w-40 p-3">
                      {dict.project.participants}
                    </th>
                    {slots.map((slot) => (
                      <th key={slot.id} className="min-w-40 border p-3">
                        <button
                          className="text-left hover:text-blue-600"
                          onClick={() => {
                            setSelectedSlot(slot);
                            setIsDialogOpen(true);
                          }}
                        >
                          <span className="block">
                            {new Date(slot.startTime).toLocaleDateString(
                              locale,
                            )}
                          </span>
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            {new Date(slot.startTime).toLocaleTimeString(
                              locale,
                              { hour: "2-digit", minute: "2-digit" },
                            )}{" "}
                            –{" "}
                            {new Date(slot.endTime).toLocaleTimeString(locale, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.id}>
                      <th className="border p-3 font-medium">
                        <div className="flex items-center gap-2">
                          {person.image && (
                            <img
                              src={person.image}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover"
                            />
                          )}
                          {person.name || person.email}
                        </div>
                      </th>
                      {slots.map((slot) => {
                        const status = slot.responses.find(
                          (response) => response.userId === person.id,
                        )?.status;
                        return (
                          <td key={slot.id} className="border p-2">
                            <span
                              className={`block rounded p-3 text-center text-xs ${status === "ACCEPTED" ? "bg-green-50 text-green-700" : status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-500"}`}
                            >
                              {status === "ACCEPTED"
                                ? `✓ ${t("design.yes")}`
                                : status === "REJECTED"
                                  ? `× ${t("design.no")}`
                                  : `– ${t("design.open")}`}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <th className="border p-3">{dict.project.yourResponse}</th>
                    {slots.map((slot) => (
                      <td key={slot.id} className="border p-2">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={
                              slot.responses.some(
                                (response) =>
                                  response.userId === currentUserId &&
                                  response.status === "ACCEPTED",
                              )
                                ? "default"
                                : "outline"
                            }
                            onClick={() => handleRespond("ACCEPTED", slot.id)}
                          >
                            {t("design.yes")}
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              slot.responses.some(
                                (response) =>
                                  response.userId === currentUserId &&
                                  response.status === "REJECTED",
                              )
                                ? "default"
                                : "outline"
                            }
                            onClick={() => handleRespond("REJECTED", slot.id)}
                          >
                            {t("design.no")}
                          </Button>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-500">
              {t("design.noDates")}
            </p>
          )}
        </section>
      )}
      {view === "calendar" && (
        <Card className="overflow-hidden bg-white">
          <CardContent className="p-0 sm:p-6">
            <div className="calendar-container">
              <FullCalendar
                ref={calendarRef}
                plugins={[
                  dayGridPlugin,
                  timeGridPlugin,
                  interactionPlugin,
                  listPlugin,
                ]}
                initialView="timeGridWeek"
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek,listWeek",
                }}
                locales={[deLocale, enLocale]}
                locale={locale || "de"}
                events={events}
                eventContent={renderEventContent}
                selectable={isOwner}
                editable={isOwner}
                selectMirror={true}
                dayMaxEvents={true}
                weekends={true}
                select={handleDateSelect}
                eventClick={handleEventClick}
                eventDrop={handleEventChange}
                eventResize={handleEventChange}
                height="auto"
                allDaySlot={false}
                slotMinTime="07:00:00"
                slotMaxTime="22:00:00"
                nowIndicator={true}
                businessHours={{
                  daysOfWeek: [1, 2, 3, 4, 5],
                  startTime: "08:00",
                  endTime: "18:00",
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("design.proposeDate")}</DialogTitle>
            <DialogDescription>
              {dict.project.appointmentsDescription}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createDate} className="space-y-4">
            <div>
              <Label htmlFor="slot-start">{t("design.start")}</Label>
              <Input
                id="slot-start"
                type="datetime-local"
                value={starts}
                required
                onChange={(e) => setStarts(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="slot-end">{t("design.end")}</Label>
              <Input
                id="slot-end"
                type="datetime-local"
                value={ends}
                required
                onChange={(e) => setEnds(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? t("common.saving") : t("design.proposeDate")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dict.project.appointmentDetails || "Termindetails"}
            </DialogTitle>
            <DialogDescription>
              {selectedSlot && (
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>
                    {new Date(selectedSlot.startTime).toLocaleString(
                      locale ?? "de-DE",
                      {
                        weekday: "long",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}{" "}
                    -{" "}
                    {new Date(selectedSlot.endTime).toLocaleTimeString(
                      locale ?? "de-DE",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                {dict.project.yourResponse || "Deine Antwort"}
              </h4>
              <div className="flex gap-2">
                <Button
                  variant={
                    currentUserResponse === "ACCEPTED" ? "default" : "outline"
                  }
                  className={`flex-1 gap-2 ${currentUserResponse === "ACCEPTED" ? "bg-green-600 hover:bg-green-700" : ""}`}
                  onClick={() => handleRespond("ACCEPTED")}
                >
                  <Check className="h-4 w-4" />
                  {dict.common.accept || "Zusagen"}
                </Button>
                <Button
                  variant={
                    currentUserResponse === "REJECTED" ? "default" : "outline"
                  }
                  className={`flex-1 gap-2 ${currentUserResponse === "REJECTED" ? "bg-red-600 hover:bg-red-700" : ""}`}
                  onClick={() => handleRespond("REJECTED")}
                >
                  <X className="h-4 w-4" />
                  {dict.common.reject || "Absagen"}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">
                {dict.project.responses || "Antworten"} (
                {selectedSlot?.responses.length || 0})
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {selectedSlot?.responses.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    {dict.project.noResponsesYet || "Noch keine Antworten."}
                  </p>
                ) : (
                  selectedSlot?.responses.map((response) => (
                    <div
                      key={response.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        {response.user.image ? (
                          <img
                            src={response.user.image}
                            alt=""
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600">
                            {response.user.name?.[0] ||
                              response.user.email[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm font-medium">
                          {response.user.name || response.user.email}
                        </span>
                      </div>
                      {response.status === "ACCEPTED" ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                          <Check className="h-3 w-3 mr-1" />{" "}
                          {dict.common.accepted || "Zugesagt"}
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">
                          <X className="h-3 w-3 mr-1" />{" "}
                          {dict.common.rejected || "Abgesagt"}
                        </Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            {isOwner && (
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-600 hover:bg-red-50 p-0 h-auto"
                onClick={() => handleDeleteSlot()}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {dict.common.delete}
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {dict.common.close || "Schließen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .calendar-container .fc {
          --fc-border-color: #f1f5f9;
          --fc-today-bg-color: #f8fafc;
          font-family: inherit;
        }
        .calendar-container .fc-header-toolbar {
          padding: 1rem;
          margin-bottom: 0 !important;
        }
        .calendar-container .fc-toolbar-title {
          font-size: 1.1rem !important;
          font-weight: 700;
        }
        .calendar-container .fc-button {
          background-color: white !important;
          border: 1px solid #e2e8f0 !important;
          color: #475569 !important;
          font-weight: 600 !important;
          font-size: 0.875rem !important;
          text-transform: capitalize !important;
          box-shadow: none !important;
        }
        .calendar-container .fc-button-primary:not(:disabled).fc-button-active,
        .calendar-container .fc-button-primary:not(:disabled):active {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
        }
        .calendar-container .fc-event {
          cursor: pointer;
          transition: transform 0.1s;
          border-radius: 6px;
          padding: 2px;
        }
        .calendar-container .fc-event:hover {
          transform: scale(1.02);
          filter: brightness(0.95);
        }
        .calendar-container .fc-timegrid-slot {
          height: 3rem !important;
        }
      `}</style>
    </div>
  );
}
