"use client"

import { useState, useRef, useCallback, ReactNode, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, FileImage, FolderOpen, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/I18nProvider"

interface ImageUploadProps {
    uploadUrl: string
    onSuccess: () => void
    label?: string
    className?: string
    compact?: boolean
    children?: ReactNode
    disabled?: boolean
    maxSize?: number
    enableFolderUpload?: boolean
    folderId?: string
}

export default function ImageUpload({
    uploadUrl,
    onSuccess,
    label,
    className,
    compact,
    children,
    disabled,
    maxSize,
    enableFolderUpload,
    folderId
}: ImageUploadProps) {
    const { t } = useI18n()
    const defaultLabel = label || t('selection.dragAndDrop')
    const [uploadingCount, setUploadingCount] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const [uploadMode, setUploadMode] = useState<'file' | 'folder'>('file')
    const [showModeDropdown, setShowModeDropdown] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Set webkitdirectory attribute based on uploadMode
    useEffect(() => {
        if (fileInputRef.current) {
            if (uploadMode === 'folder') {
                fileInputRef.current.setAttribute('webkitdirectory', '')
                fileInputRef.current.setAttribute('directory', '')
            } else {
                fileInputRef.current.removeAttribute('webkitdirectory')
                fileInputRef.current.removeAttribute('directory')
            }
        }
    }, [uploadMode])

    const uploadFiles = useCallback(async (files: (File & { relativePath?: string })[]) => {
        const fileArray = files.filter(file => file.type.startsWith("image/"))

        if (fileArray.length === 0) {
            alert(t('selection.pleaseUploadImages'))
            return
        }

        setUploadingCount(prev => prev + fileArray.length)

        const uploadPromises = fileArray.map(async (file) => {
            const formData = new FormData()
            formData.append("file", file)
            if (file.relativePath) {
                formData.append("relativePath", file.relativePath)
            }
            if (folderId) {
                formData.append("folderId", folderId)
            }

            try {
                const response = await fetch(uploadUrl, {
                    method: "POST",
                    body: formData,
                })

                if (!response.ok) {
                    const error = await response.json()
                    console.error(`Upload failed for ${file.name}:`, error.error)
                }
            } catch (error) {
                console.error(`Upload error for ${file.name}:`, error)
            } finally {
                setUploadingCount(prev => Math.max(0, prev - 1))
            }
        })

        await Promise.all(uploadPromises)
        onSuccess()
        if (fileInputRef.current) fileInputRef.current.value = ""
    }, [uploadUrl, onSuccess, t])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            const fileArray = Array.from(files) as (File & { relativePath?: string })[]
            // For folder upload via input, webkitRelativePath is available
            fileArray.forEach(f => {
                if ((f as any).webkitRelativePath) {
                    f.relativePath = (f as any).webkitRelativePath
                }
            })
            uploadFiles(fileArray)
        }
    }

    const onDragOver = useCallback((e: React.DragEvent) => {
        if (disabled) return
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }, [disabled])

    const onDragLeave = useCallback((e: React.DragEvent) => {
        if (disabled) return
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [disabled])

    const scanFiles = async (item: FileSystemEntry, path = ""): Promise<(File & { relativePath?: string })[]> => {
        try {
            if (item.isFile) {
                return new Promise((resolve, reject) => {
                    (item as FileSystemFileEntry).file(
                        (file) => {
                            const extendedFile = file as File & { relativePath?: string }
                            extendedFile.relativePath = path + file.name
                            resolve([extendedFile])
                        },
                        (error) => {
                            console.error("Error reading file:", error)
                            resolve([]) // Skip files that can't be read
                        }
                    )
                })
            } else if (item.isDirectory) {
                const reader = (item as FileSystemDirectoryEntry).createReader()
                
                const readAllEntries = async (): Promise<FileSystemEntry[]> => {
                    let all: FileSystemEntry[] = []
                    let result: FileSystemEntry[] = []
                    do {
                        result = await new Promise<FileSystemEntry[]>((resolve) => {
                            reader.readEntries(
                                (results) => resolve(results),
                                (error) => {
                                    console.error("Error reading directory:", error)
                                    resolve([])
                                }
                            )
                        })
                        all.push(...result)
                    } while (result.length > 0)
                    return all
                }

                const entries = await readAllEntries()
                const files = await Promise.all(entries.map(entry => scanFiles(entry, path + item.name + "/")))
                return files.flat()
            }
        } catch (error) {
            console.error("Error scanning entries:", error)
        }
        return []
    }

    const onDrop = useCallback(async (e: React.DragEvent) => {
        if (disabled) return
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const items = e.dataTransfer.items
        if (items && items.length > 0) {
            const files: (File & { relativePath?: string })[] = []
            
            for (let i = 0; i < items.length; i++) {
                const item = items[i].webkitGetAsEntry()
                if (item) {
                    const scanned = await scanFiles(item)
                    files.push(...scanned)
                }
            }

            if (files.length > 0) {
                uploadFiles(files)
            }
        } else {
            const files = e.dataTransfer.files
            if (files && files.length > 0) {
                uploadFiles(Array.from(files))
            }
        }
    }, [uploadFiles, disabled])

    const isUploading = uploadingCount > 0

    // If acting as a wrapper
    if (children) {
        return (
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={cn("relative transition-all duration-200", className)}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                    multiple
                />

                {children}

                {/* Drop Overlay */}
                {isDragging && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-blue-500/10 backdrop-blur-[2px] border-2 border-primary border-dashed pointer-events-none">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl border border-blue-200 flex flex-col items-center gap-2 animate-in zoom-in-95 duration-200">
                            <Upload className="h-10 w-10 text-blue-500 animate-bounce" />
                            <p className="font-bold text-lg">{t('moodboard.dropToUpload')}</p>
                            <p className="text-sm text-gray-500">{t('moodboard.addToGroup')}</p>
                        </div>
                    </div>
                )}

                {/* Uploading indicator for wrapper mode */}
                {isUploading && (
                    <div className="absolute top-2 right-2 z-50 bg-white/90 backdrop-blur py-1 px-3 rounded-full shadow-sm border flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        <span className="text-xs font-medium">{t('selection.uploading').replace('{count}', uploadingCount.toString())}</span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={cn(
                "relative flex flex-col items-center justify-center transition-all duration-200 w-full h-full border-2 border-dashed rounded-xl",
                compact ? "min-h-[44px] gap-1 p-1" : "min-h-[150px] gap-4 p-4",
                isDragging ? "border-blue-500 bg-blue-50/50" : "border-gray-200 bg-gray-50/50 hover:bg-gray-100/50",
                (isUploading || disabled) && "opacity-80 pointer-events-none",
                className
            )}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
                multiple
                disabled={disabled || isUploading}
            />

            <div className={cn("flex items-center text-center", compact ? "flex-row gap-2" : "flex-col")}>
                <div className={cn(
                    "rounded-full transition-colors flex items-center justify-center",
                    compact ? "p-1" : "p-3 mb-2 bg-gray-100 text-gray-400",
                    isDragging && !compact && "bg-blue-100 text-blue-600",
                    compact && isDragging && "text-blue-600"
                )}>
                    {isUploading ? (
                        <Loader2 className={cn("animate-spin text-blue-500", compact ? "h-4 w-4" : "h-6 w-6")} />
                    ) : (
                        uploadMode === 'folder' ? <FolderOpen className={cn(compact ? "h-4 w-4" : "h-6 w-6")} /> : <Upload className={cn(compact ? "h-4 w-4" : "h-6 w-6")} />
                    )}
                </div>

                <p className={cn("font-medium text-gray-700", compact ? "text-xs" : "text-sm")}>
                    {isUploading ? t('selection.uploading').replace('{count}', uploadingCount.toString()) : isDragging ? t('results.dropToUpload') : (uploadMode === 'folder' ? t('results.uploadFolder') : defaultLabel)}
                </p>

                {!compact && !isUploading && (
                    <p className="text-xs text-gray-400 mt-1">
                        {t('selection.imageConstraints')}
                    </p>
                )}
            </div>

            {!compact && !isUploading && (
                <div className="flex flex-col items-center gap-2 mt-2">
                    {enableFolderUpload ? (
                        <div className="flex items-center gap-1">
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={isUploading || disabled}
                                onClick={() => fileInputRef.current?.click()}
                                className="rounded-r-none border-r-0"
                            >
                                {uploadMode === 'folder' ? t('results.uploadFolder') : t('results.uploadFiles')}
                            </Button>
                            <div className="relative">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="px-2 rounded-l-none border-l border-gray-200"
                                    onClick={() => setShowModeDropdown(!showModeDropdown)}
                                >
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                                {showModeDropdown && (
                                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-[60] min-w-[150px] overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
                                        <button
                                            className={cn(
                                                "w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2",
                                                uploadMode === 'file' && "bg-blue-50 text-blue-600 font-medium"
                                            )}
                                            onClick={() => {
                                                setUploadMode('file');
                                                setShowModeDropdown(false);
                                            }}
                                        >
                                            <Upload className="h-4 w-4" />
                                            {t('results.uploadFiles')}
                                        </button>
                                        <button
                                            className={cn(
                                                "w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2",
                                                uploadMode === 'folder' && "bg-blue-50 text-blue-600 font-medium"
                                            )}
                                            onClick={() => {
                                                setUploadMode('folder');
                                                setShowModeDropdown(false);
                                            }}
                                        >
                                            <FolderOpen className="h-4 w-4" />
                                            {t('results.uploadFolder')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={isUploading || disabled}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {t('selection.selectFiles')}
                        </Button>
                    )}
                </div>
            )}

            {compact && !isUploading && !disabled && (
                <button
                    className="absolute inset-0 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                />
            )}

            {isDragging && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-blue-500/10 pointer-events-none">
                    <div className="bg-white p-3 rounded-lg shadow-lg border border-blue-200">
                        <FileImage className="h-8 w-8 text-blue-500" />
                    </div>
                </div>
            )}
        </div>
    )
}
