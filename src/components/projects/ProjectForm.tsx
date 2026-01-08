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
  }
}

export function ProjectForm({ onSuccess, initialData }: ProjectFormProps) {
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
          })
        }
        onSuccess?.()
      } else {
        const error = await response.json()
        alert(error.error || `Failed to ${isEditing ? "update" : "create"} project`)
      }
    } catch (error) {
      alert(`An error occurred while ${isEditing ? "updating" : "creating"} the project`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEditing ? "outline" : "default"}>
          {isEditing ? "Edit Project" : "+ New Project"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Project" : "Create New Project"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update your photoshoot project details."
                : "Add a new photoshoot project to organize your work."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Summer Fashion Shoot"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Describe your project..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
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
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="New York City"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="123 Main St, New York, NY 10001"
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50/50">
              <div className="space-y-0.5">
                <Label htmlFor="isPublic">Public Access</Label>
                <p className="text-xs text-muted-foreground">
                  Allow anyone with the link to view this project.
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
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Module Visibility</Label>
                <div className="grid grid-cols-2 gap-3">
                  <ModuleToggle
                    label="Moodboard"
                    value={formData.showMoodboardPublicly}
                    onChange={(checked) => setFormData({ ...formData, showMoodboardPublicly: checked })}
                  />
                  <ModuleToggle
                    label="Team"
                    value={formData.showParticipantsPublicly}
                    onChange={(checked) => setFormData({ ...formData, showParticipantsPublicly: checked })}
                  />
                  <ModuleToggle
                    label="Selection"
                    value={formData.showSelectionPublicly}
                    onChange={(checked) => setFormData({ ...formData, showSelectionPublicly: checked })}
                  />
                  <ModuleToggle
                    label="Contracts"
                    value={formData.showContractsPublicly}
                    onChange={(checked) => setFormData({ ...formData, showContractsPublicly: checked })}
                  />
                  <ModuleToggle
                    label="Callsheet"
                    value={formData.showCallsheetPublicly}
                    onChange={(checked) => setFormData({ ...formData, showCallsheetPublicly: checked })}
                  />
                  <ModuleToggle
                    label="Results"
                    value={formData.showResultsPublicly}
                    onChange={(checked) => setFormData({ ...formData, showResultsPublicly: checked })}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? (isEditing ? "Updating..." : "Creating...")
                : (isEditing ? "Update Project" : "Create Project")}
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
