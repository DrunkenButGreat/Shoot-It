"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { LayoutGrid, Columns } from "lucide-react"
import { useI18n } from "@/components/I18nProvider"

interface ProjectFormProps {
  onSuccess?: () => void
  initialData?: {
    id: string
    name: string
    description: string | null
    date: Date | string | null
    location: string | null
    address: string | null
    isPublic: boolean
    showMoodboardPublicly: boolean
    showParticipantsPublicly: boolean
    showContractsPublicly: boolean
    showSelectionPublicly: boolean
    showCallsheetPublicly: boolean
    showResultsPublicly: boolean
    showAppointmentsPublicly: boolean
    allowApplications: boolean
    allowAppointments: boolean
    galleryLayout: string
  }
}

export function ProjectForm({ onSuccess, initialData }: ProjectFormProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    date: initialData?.date ? new Date(initialData.date).toISOString().split('T')[0] : "",
    location: initialData?.location || "",
    address: initialData?.address || "",
    isPublic: initialData?.isPublic ?? false,
    showMoodboardPublicly: initialData?.showMoodboardPublicly ?? false,
    showParticipantsPublicly: initialData?.showParticipantsPublicly ?? false,
    showContractsPublicly: initialData?.showContractsPublicly ?? false,
    showSelectionPublicly: initialData?.showSelectionPublicly ?? false,
    showCallsheetPublicly: initialData?.showCallsheetPublicly ?? false,
    showResultsPublicly: initialData?.showResultsPublicly ?? false,
    showAppointmentsPublicly: initialData?.showAppointmentsPublicly ?? false,
    allowApplications: initialData?.allowApplications ?? false,
    allowAppointments: initialData?.allowAppointments ?? false,
    galleryLayout: initialData?.galleryLayout || "masonry",
  })

  const isEditing = !!initialData

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const body: any = { ...formData }
      if (formData.date) {
        body.date = new Date(formData.date).toISOString()
      } else {
        body.date = null
      }

      const url = isEditing ? `/api/projects/${initialData.id}` : "/api/projects"
      const method = isEditing ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        setOpen(false)
        if (!isEditing) {
          setFormData({
            name: "",
            description: "",
            date: "",
            location: "",
            address: "",
            isPublic: false,
            showMoodboardPublicly: false,
            showParticipantsPublicly: false,
            showContractsPublicly: false,
            showSelectionPublicly: false,
            showCallsheetPublicly: false,
            showResultsPublicly: false,
            showAppointmentsPublicly: false,
            allowApplications: false,
            allowAppointments: false,
            galleryLayout: "masonry",
          })
        }
        onSuccess?.()
      } else {
        const error = await response.json()
        alert(error.error || (isEditing ? t('projectForm.updateProject') : t('projectForm.createProject')))
      }
    } catch (error) {
      alert(t('common.error'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEditing ? "outline" : "default"}>
          {isEditing ? t('projectForm.editProject') : `+ ${t('projectForm.newProject')}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? t('projectForm.editProject') : t('projectForm.createProject')}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? t('projectForm.isEditingDescription')
                : t('projectForm.isCreatingDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t('projectForm.projectName')} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={t('projectForm.projectNamePlaceholder')}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">{t('projectForm.description')}</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t('projectForm.descriptionPlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">{t('projectForm.date')}</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">{t('projectForm.location')}</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder={t('projectForm.locationPlaceholder')}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">{t('projectForm.address')}</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder={t('projectForm.addressPlaceholder')}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
              <div className="space-y-0.5">
                <Label htmlFor="isPublic">{t('projectForm.publicAccess')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('projectForm.publicAccessDescription')}
                </p>
              </div>
              <Switch
                id="isPublic"
                checked={formData.isPublic}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isPublic: checked })
                }
              />
            </div>

            {formData.isPublic && (
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="allowApplications">{t('projectForm.allowApplications')}</Label>
                    <p className="text-[10px] text-gray-500">{t('projectForm.allowApplicationsDescription')}</p>
                    {!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && formData.allowApplications && (
                      <p className="text-[10px] text-red-500 font-bold mt-1">
                        {t('projectForm.recaptchaMissingWarning')}
                      </p>
                    )}
                  </div>
                  <Switch
                    id="allowApplications"
                    checked={formData.allowApplications}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, allowApplications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="allowAppointments">{t('projectForm.allowAppointments')}</Label>
                    <p className="text-[10px] text-gray-500">{t('projectForm.allowAppointmentsDescription')}</p>
                  </div>
                  <Switch
                    id="allowAppointments"
                    checked={formData.allowAppointments}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, allowAppointments: checked })
                    }
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('projectForm.moduleVisibility')}</Label>
                  <div className="grid grid-cols-2 gap-3">
                  <ModuleToggle
                    label={t('projectForm.showMoodboard')}
                    value={formData.showMoodboardPublicly}
                    onChange={(checked) => setFormData({ ...formData, showMoodboardPublicly: checked })}
                  />
                  <ModuleToggle
                    label={t('projectForm.showParticipants')}
                    value={formData.showParticipantsPublicly}
                    onChange={(checked) => setFormData({ ...formData, showParticipantsPublicly: checked })}
                  />
                  <ModuleToggle
                    label={t('projectForm.showSelection')}
                    value={formData.showSelectionPublicly}
                    onChange={(checked) => setFormData({ ...formData, showSelectionPublicly: checked })}
                  />
                  <ModuleToggle
                    label={t('projectForm.showContracts')}
                    value={formData.showContractsPublicly}
                    onChange={(checked) => setFormData({ ...formData, showContractsPublicly: checked })}
                  />
                  <ModuleToggle
                    label={t('projectForm.showCallsheet')}
                    value={formData.showCallsheetPublicly}
                    onChange={(checked) => setFormData({ ...formData, showCallsheetPublicly: checked })}
                  />
                  <ModuleToggle
                    label={t('projectForm.showResults')}
                    value={formData.showResultsPublicly}
                    onChange={(checked) => setFormData({ ...formData, showResultsPublicly: checked })}
                  />
                  <ModuleToggle
                    label={t('projectForm.showAppointments')}
                    value={formData.showAppointmentsPublicly}
                    onChange={(checked) => setFormData({ ...formData, showAppointmentsPublicly: checked })}
                  />
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('projectForm.galleryStyle')}</Label>
                  <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, galleryLayout: "justified" })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${formData.galleryLayout === "justified"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      {t('projectForm.justified')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, galleryLayout: "masonry" })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${formData.galleryLayout === "masonry"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                      <Columns className="h-3.5 w-3.5" />
                      {t('projectForm.masonry')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, galleryLayout: "grid" })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${formData.galleryLayout === "grid"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                      {t('projectForm.grid')}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground italic leading-tight">
                  {formData.galleryLayout === "justified"
                    ? t('projectForm.justifiedDescription')
                    : formData.galleryLayout === "masonry"
                      ? t('projectForm.masonryDescription')
                      : t('projectForm.gridDescription')}
                </p>
              </div>
            </div>
          )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? (isEditing ? t('common.updating') : t('common.creating'))
                : (isEditing ? t('common.update') : t('common.create'))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ModuleToggle({ label, value, onChange }: { label: string, value: boolean, onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md border border-gray-100 bg-white shadow-sm">
      <span className="text-[10px] font-bold uppercase text-gray-500">{label}</span>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        className="scale-75 origin-right"
      />
    </div>
  )
}
