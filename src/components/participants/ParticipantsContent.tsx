"use client";

import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ParticipantCard } from "./ParticipantCard";
import { ParticipantForm } from "./ParticipantForm";

interface Participant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  notes: string | null;
  createdAt: Date;
  images: any[];
  customFields: any[];
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

interface ParticipantsContentProps {
  projectId: string;
  initialParticipants: Participant[];
}

export function ParticipantsContent({
  projectId,
  initialParticipants: participants,
}: ParticipantsContentProps) {
  const router = useRouter();
  const { t } = useI18n();

  const handleParticipantAdded = () => {
    router.refresh();
  };

  const handleParticipantDeleted = () => {
    router.refresh();
  };

  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [view, setView] = useState("grid");
  const [selected, setSelected] = useState<Participant | null>(null);
  const [saving, setSaving] = useState(false);
  const roles = [
    ...new Set(
      participants
        .map((person) => person.role)
        .filter((role): role is string => !!role),
    ),
  ];
  const visible = participants.filter(
    (person) =>
      (!role || person.role === role) &&
      `${person.name} ${person.email || ""} ${person.role || ""}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || selected.id.startsWith("owner-")) return;
    setSaving(true);
    try {
      const { name, email, phone, role, notes } = selected;
      const response = await fetch(
        `/api/projects/${projectId}/participants/${selected.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email: email || "",
            phone: phone || "",
            role: role || "",
            notes: notes || "",
          }),
        },
      );
      if (!response.ok) throw new Error();
      toast.success(t("common.saveChanges"));
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="studio-page-title">{t("participants.title")}</h1>
          <p className="studio-page-subtitle">{t("design.teamSubtitle")}</p>
        </div>
        <ParticipantForm
          projectId={projectId}
          onSuccess={handleParticipantAdded}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex flex-wrap gap-1">
          {["", ...roles].map((value) => (
            <button
              key={value}
              onClick={() => setRole(value)}
              className={`border-b-2 px-3 py-2 text-xs ${role === value ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"}`}
            >
              {value || t("design.all")}{" "}
              <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5">
                {
                  participants.filter(
                    (person) => !value || person.role === value,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              aria-label={t("design.searchPeople")}
              placeholder={t("design.searchPeople")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-52 pl-9"
            />
          </div>
          <Button
            size="icon"
            variant={view === "grid" ? "secondary" : "ghost"}
            onClick={() => setView("grid")}
            aria-label={t("design.gridView")}
            aria-pressed={view === "grid"}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={view === "list" ? "secondary" : "ghost"}
            onClick={() => setView("list")}
            aria-label={t("design.listView")}
            aria-pressed={view === "list"}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <div className="min-w-0 w-full flex-1">
          {visible.length ? (
            <div
              className={
                view === "list"
                  ? "space-y-3"
                  : `grid grid-cols-1 gap-4 sm:grid-cols-2 ${selected ? "2xl:grid-cols-3" : "xl:grid-cols-3"}`
              }
            >
              {visible.map((person) => (
                <ParticipantCard
                  key={person.id}
                  participant={person}
                  projectId={projectId}
                  selected={selected?.id === person.id}
                  list={view === "list"}
                  onSelect={() => setSelected(person)}
                  onDelete={() => {
                    if (selected?.id === person.id) setSelected(null);
                    handleParticipantDeleted();
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="studio-panel p-12 text-center text-sm text-slate-500">
              {participants.length
                ? t("common.noResults")
                : t("participants.noParticipants")}
            </div>
          )}
        </div>
        {selected && (
          <form
            key={selected.id}
            onSubmit={save}
            className="studio-panel w-full shrink-0 p-4 xl:sticky xl:top-20 xl:w-72"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("common.details")}</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelected(null)}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {(selected.images[0]?.path || selected.user?.image) && (
              <img
                src={
                  selected.images[0]?.thumbnail ||
                  selected.images[0]?.path ||
                  selected.user?.image ||
                  ""
                }
                alt=""
                className="mb-4 aspect-[4/3] w-full rounded-md object-cover"
              />
            )}
            <fieldset
              disabled={selected.id.startsWith("owner-") || saving}
              className="space-y-3"
            >
              {(["name", "role", "email", "phone"] as const).map((field) => (
                <div key={field}>
                  <Label htmlFor={`person-${field}`} className="text-xs">
                    {t(`participants.${field}`)}
                  </Label>
                  <Input
                    id={`person-${field}`}
                    type={field === "email" ? "email" : "text"}
                    required={field === "name"}
                    value={selected[field] || ""}
                    onChange={(e) =>
                      setSelected({ ...selected, [field]: e.target.value })
                    }
                  />
                </div>
              ))}
              <div>
                <Label htmlFor="person-notes" className="text-xs">
                  {t("participants.notes")}
                </Label>
                <Textarea
                  id="person-notes"
                  rows={5}
                  maxLength={5000}
                  value={selected.notes || ""}
                  onChange={(e) =>
                    setSelected({ ...selected, notes: e.target.value })
                  }
                />
              </div>
              {!selected.id.startsWith("owner-") && (
                <Button type="submit" className="w-full">
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
              )}
            </fieldset>
          </form>
        )}
      </div>
    </div>
  );
}
