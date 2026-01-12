"use client"

import { useState, useEffect } from "react"
import { Folder, Loader2, Import } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/I18nProvider"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

interface LocalMediaPickerProps {
    projectId: string
    onSuccess: () => void
    importUrl: string
    label?: string
}

export function LocalMediaPicker({ projectId, onSuccess, importUrl, label }: LocalMediaPickerProps) {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)
    const [folders, setFolders] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [importing, setImporting] = useState<string | null>(null)

    const displayLabel = label || t('selection.importFromLocal')

    useEffect(() => {
        if (open) {
            fetchFolders()
        }
    }, [open])

    const fetchFolders = async () => {
        setLoading(true)
        try {
            const response = await fetch("/api/local-media")
            const data = await response.json()
            setFolders(data.folders || [])
        } catch (error) {
            console.error("Failed to fetch folders:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleImport = async (folderName: string) => {
        setImporting(folderName)
        try {
            const response = await fetch(importUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folderName }),
            })

            if (response.ok) {
                setOpen(false)
                onSuccess()
            } else {
                const errorData = await response.json()
                alert(errorData.error || "Failed to import images")
            }
        } catch (error) {
            console.error("Import error:", error)
            alert("An error occurred during import")
        } finally {
            setImporting(null)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <Folder className="h-4 w-4" />
                    {label}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{t('selection.selectFolder')}</DialogTitle>
                    <DialogDescription>
                        {t('selection.selectFolderDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : folders.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            {t('selection.noFoldersFound')}
                        </div>
                    ) : (
                        <div className="h-72 w-full rounded-md border p-2 overflow-y-auto">
                            <div className="space-y-2">
                                {folders.map((folder) => (
                                    <div
                                        key={folder}
                                        className="flex items-center justify-between p-3 hover:bg-gray-100 rounded-lg transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Folder className="h-5 w-5 text-blue-500" />
                                            <span className="font-medium text-sm">{folder}</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleImport(folder)}
                                            disabled={importing !== null}
                                        >
                                            {importing === folder ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <Import className="h-4 w-4" />
                                                    <span>{t('selection.import')}</span>
                                                </div>
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="sm:justify-start">
                    <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                        {t('common.cancel')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
