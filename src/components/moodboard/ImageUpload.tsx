"use client"

import { useState, useRef, useCallback, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, FileImage } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImageUploadProps {
    uploadUrl: string
    onSuccess: () => void
    label?: string
    className?: string
    compact?: boolean
    children?: ReactNode
}

export default function ImageUpload({
    uploadUrl,
    onSuccess,
    label = "Upload Image",
    className,
    compact,
    children
}: ImageUploadProps) {
    const [uploadingCount, setUploadingCount] = useState(0)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const uploadFiles = useCallback(async (files: FileList | File[]) => {
        const fileArray = Array.from(files).filter(file => file.type.startsWith("image/"))

        if (fileArray.length === 0) {
            alert("Please upload image files")
            return
        }

        setUploadingCount(prev => prev + fileArray.length)

        const uploadPromises = fileArray.map(async (file) => {
            const formData = new FormData()
            formData.append("file", file)

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
    }, [uploadUrl, onSuccess])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            uploadFiles(files)
        }
    }

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(true)
    }, [])

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)
    }, [])

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        const files = e.dataTransfer.files
        if (files && files.length > 0) {
            uploadFiles(files)
        }
    }, [uploadFiles])

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
                            <p className="font-bold text-lg">Drop to upload</p>
                            <p className="text-sm text-gray-500">Add to this group</p>
                        </div>
                    </div>
                )}

                {/* Uploading indicator for wrapper mode */}
                {isUploading && (
                    <div className="absolute top-2 right-2 z-50 bg-white/90 backdrop-blur py-1 px-3 rounded-full shadow-sm border flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        <span className="text-xs font-medium">Uploading {uploadingCount}...</span>
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
                isUploading && "opacity-80 pointer-events-none",
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
                        <Upload className={cn(compact ? "h-4 w-4" : "h-6 w-6")} />
                    )}
                </div>

                <p className={cn("font-medium text-gray-700", compact ? "text-xs" : "text-sm")}>
                    {isUploading ? `Uploading ${uploadingCount}...` : isDragging ? "Drop" : label}
                </p>

                {!compact && !isUploading && (
                    <p className="text-xs text-gray-400 mt-1">
                        JPG, PNG, WebP or GIF (max. 10MB)
                    </p>
                )}
            </div>

            {!compact && !isUploading && (
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2"
                >
                    Select Files
                </Button>
            )}

            {compact && !isUploading && (
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
