"use client"

import { useState, useEffect } from "react"
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
import { cn } from "@/lib/utils"

interface ProjectFormData {
  name: string
  description: string
  date: string
  location: string
  address: string
  isPublic: boolean
  showMoodboardPublicly: boolean
  showParticipantsPublicly: boolean
  showContractsPublicly: boolean
  showSelectionPublicly: boolean
  showSelectionFolders: boolean
  showCallsheetPublicly: boolean
  showResultsPublicly: boolean
  showAppointmentsPublicly: boolean
  allowGuestSelection: boolean
  allowApplications: boolean
  allowAppointments: boolean
  galleryLayout: string
}

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
    showSelectionFolders: boolean
    showCallsheetPublicly: boolean
    showResultsPublicly: boolean
    showAppointmentsPublicly: boolean
    allowApplications: boolean
    allowAppointments: boolean
    allowGuestSelection: boolean
    galleryLayout: string
  }
}

export function ProjectForm({ onSuccess, initialData }: ProjectFormProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'settings' | 'visibility'>('details')
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<ProjectFormData>({
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
    showSelectionFolders: initialData?.showSelectionFolders ?? true,
    showCallsheetPublicly: initialData?.showCallsheetPublicly ?? false,
    showResultsPublicly: initialData?.showResultsPublicly ?? false,
    showAppointmentsPublicly: !!initialData?.showAppointmentsPublicly,
    allowGuestSelection: !!initialData?.allowGuestSelection,
    allowApplications: !!initialData?.allowApplications,
    allowAppointments: !!initialData?.allowAppointments,
    galleryLayout: initialData?.galleryLayout || "masonry",
  })

  useEffect(() => {
    if (initialData && open) {
      setFormData({
        name: initialData.name,
        description: initialData.description || "",
        date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : "",
        location: initialData.location || "",
        address: initialData.address || "",
        isPublic: !!initialData.isPublic,
        showMoodboardPublicly: !!initialData.showMoodboardPublicly,
        showParticipantsPublicly: !!initialData.showParticipantsPublicly,
        showContractsPublicly: !!initialData.showContractsPublicly,
        showSelectionPublicly: !!initialData.showSelectionPublicly,
        showSelectionFolders: !!initialData.showSelectionFolders,
        showCallsheetPublicly: !!initialData.showCallsheetPublicly,
        showResultsPublicly: !!initialData.showResultsPublicly,
        showAppointmentsPublicly: !!initialData.showAppointmentsPublicly,
        allowGuestSelection: !!initialData.allowGuestSelection,
        allowApplications: !!initialData.allowApplications,
        allowAppointments: !!initialData.allowAppointments,
        galleryLayout: initialData.galleryLayout,
      })
    }
  }, [initialData, open])

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
            showSelectionFolders: true,
            showCallsheetPublicly: false,
            showResultsPublicly: false,
            showAppointmentsPublicly: false,
            allowGuestSelection: false,
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
      <DialogContent className="sm:max-w-[550px] w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="p-6 pb-4 shrink-0 space-y-4 border-b border-gray-100 bg-white">
            <div>
              <DialogTitle>{isEditing ? t('projectForm.editProject') : t('projectForm.createProject')}</DialogTitle>
              <DialogDescription>
                {isEditing
                  ? t('projectForm.isEditingDescription')
                  : t('projectForm.isCreatingDescription')}
              </DialogDescription>
            </div>

            <div className="flex items-center gap-1 bg-gray-100/50 p-1 rounded-lg border border-gray-100">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={cn(
                  "flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                  activeTab === 'details' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t('projectForm.tabDetails')}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={cn(
                  "flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                  activeTab === 'settings' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {t('projectForm.tabSettings')}
              </button>
              <button
                type="button"
                disabled={!formData.isPublic}
                onClick={() => setActiveTab('visibility')}
                className={cn(
                  "flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                  activeTab === 'visibility' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700",
                  !formData.isPublic && "opacity-50 cursor-not-allowed"
                )}
              >
                {t('projectForm.tabVisibility')}
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-6 bg-gray-50/30">
            <div className="grid gap-6">

              {activeTab === 'details' && (
                <div className="space-y-4">
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
                      className="bg-white"
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
                      className="bg-white"
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
                      className="bg-white"
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
                      className="bg-white"
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
                      className="bg-white"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6">

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                      <div className="space-y-0.5">
                        <Label htmlFor="isPublic" className="text-blue-900">{t('projectForm.publicAccess')}</Label>
                        <p className="text-xs text-blue-700/70">
                          {t('projectForm.publicAccessDescription')}
                        </p>
                      </div>
                      <Switch
                        id="isPublic"
                        checked={!!formData.isPublic}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, isPublic: checked })
                        }
                      />
                    </div>
                  </div>

                  {/* Appointments - accessible even if private? Keeping existing logic: mostly consistent but cleaner layout */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white">
                      <div className="space-y-0.5">
                        <Label htmlFor="allowAppointments">{t('projectForm.allowAppointments')}</Label>
                        <p className="text-[10px] text-gray-500">{t('projectForm.allowAppointmentsDescription')}</p>
                      </div>
                      <Switch
                        id="allowAppointments"
                        checked={!!formData.allowAppointments}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, allowAppointments: checked })
                        }
                      />
                    </div>
                  </div>

                  {formData.isPublic && (
                    <div className="space-y-3 animate-in fade-in-50 slide-in-from-top-2">
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">{t('projectForm.publicSettings')}</Label>
                      
                      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white">
                        <div className="space-y-0.5">
                          <Label htmlFor="allowGuestSelection">{t('projectForm.allowGuestSelection')}</Label>
                          <p className="text-[10px] text-gray-500">{t('projectForm.allowGuestSelectionDescription')}</p>
                        </div>
                        <Switch
                          id="allowGuestSelection"
                          checked={!!formData.allowGuestSelection}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, allowGuestSelection: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white">
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
                          checked={!!formData.allowApplications}
                          onCheckedChange={(checked) =>
                            setFormData({ ...formData, allowApplications: checked })
                          }
                        />
                      </div>

                      <div className="space-y-2 pt-2">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">{t('projectForm.galleryStyle')}</Label>
                        <div className="flex flex-wrap gap-1 bg-white p-1 rounded-lg border border-gray-100">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, galleryLayout: "justified" })}
                            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all w-full sm:w-auto justify-center", formData.galleryLayout === "justified"
                              ? "bg-blue-50 text-blue-600"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-700")}
                          >
                            <LayoutGrid className="h-4 w-4" />
                            {t('projectForm.justified')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, galleryLayout: "masonry" })}
                            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all w-full sm:w-auto justify-center", formData.galleryLayout === "masonry"
                                ? "bg-blue-50 text-blue-600"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700")}
                          >
                            <Columns className="h-4 w-4" />
                            {t('projectForm.masonry')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, galleryLayout: "grid" })}
                            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all w-full sm:w-auto justify-center", formData.galleryLayout === "grid"
                                ? "bg-blue-50 text-blue-600"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700")}
                          >
                            <LayoutGrid className="h-4 w-4" />
                            {t('projectForm.grid')}
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic leading-tight pl-1">
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
              )}

              {activeTab === 'visibility' && formData.isPublic && (
                <div className="space-y-3">
                  <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('projectForm.moduleVisibility')}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    {formData.showSelectionPublicly && (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-200 sm:col-span-2 shadow-sm">
                        <div className="space-y-0.5">
                          <Label htmlFor="showSelectionFolders" className="text-sm font-medium">{t('projectForm.useFolders')}</Label>
                          <p className="text-[10px] text-gray-500">{t('projectForm.useFoldersDescription')}</p>
                        </div>
                        <Switch
                          id="showSelectionFolders"
                          checked={formData.showSelectionFolders}
                          onCheckedChange={(checked) => setFormData({ ...formData, showSelectionFolders: checked })}
                        />
                      </div>
                    )}
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
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 shrink-0 bg-white border-t border-gray-100 w-full sm:justify-end">
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
