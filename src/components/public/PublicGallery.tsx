"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react"

interface Image {
    id: string
    path: string
    filename: string
}

interface PublicGalleryProps {
    images: Image[]
    columns?: number
    aspectRatio?: "square" | "portrait"
}

export function PublicGallery({ images, columns = 4, aspectRatio = "square" }: PublicGalleryProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedIndex === null) return
            if (e.key === "Escape") closeLightbox()
            if (e.key === "ArrowRight") nextImage()
            if (e.key === "ArrowLeft") prevImage()
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [selectedIndex])

    const aspectClass = aspectRatio === "square" ? "aspect-square" : "aspect-[2/3]"

    const openLightbox = (index: number) => {
        setSelectedIndex(index)
        document.body.style.overflow = 'hidden'
    }

    const closeLightbox = () => {
        setSelectedIndex(null)
        document.body.style.overflow = 'unset'
    }

    const nextImage = (e?: React.MouseEvent) => {
        e?.stopPropagation()
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex + 1) % images.length)
        }
    }

    const prevImage = (e?: React.MouseEvent) => {
        e?.stopPropagation()
        if (selectedIndex !== null) {
            setSelectedIndex((selectedIndex - 1 + images.length) % images.length)
        }
    }

    const lightbox = selectedIndex !== null && mounted ? createPortal(
        <div
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
            onClick={closeLightbox}
        >
            {/* Glass Navigation Bar */}
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/60 to-transparent z-[10000] flex items-center justify-between px-6 md:px-10">
                <div className="text-white/80">
                    <p className="text-sm font-bold uppercase tracking-widest">{images[selectedIndex].filename}</p>
                    <p className="text-xs text-white/50">{selectedIndex + 1} / {images.length}</p>
                </div>
                <button
                    className="p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-2xl transition-all shadow-xl backdrop-blur-md border border-white/10"
                    onClick={closeLightbox}
                >
                    <X className="h-6 w-6" />
                </button>
            </div>

            {/* Navigation Buttons */}
            <button
                className="absolute left-6 top-1/2 -translate-y-1/2 p-4 md:p-6 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-3xl transition-all group z-[10000] backdrop-blur-sm border border-white/5"
                onClick={prevImage}
            >
                <ChevronLeft className="h-8 w-8 md:h-10 md:w-10 group-active:scale-90" />
            </button>

            <button
                className="absolute right-6 top-1/2 -translate-y-1/2 p-4 md:p-6 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-3xl transition-all group z-[10000] backdrop-blur-sm border border-white/5"
                onClick={nextImage}
            >
                <ChevronRight className="h-8 w-8 md:h-10 md:w-10 group-active:scale-90" />
            </button>

            {/* Main Content */}
            <div
                className="relative w-full h-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={images[selectedIndex].path}
                    alt={images[selectedIndex].filename}
                    className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-500"
                />
            </div>
        </div>,
        document.body
    ) : null

    return (
        <>
            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-${columns} gap-4`}>
                {images.map((image, index) => (
                    <div
                        key={image.id}
                        className={`${aspectClass} relative rounded-xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all border border-gray-100 bg-gray-50`}
                        onClick={() => openLightbox(index)}
                    >
                        <img
                            src={image.path}
                            alt={image.filename}
                            className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-110"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Error+Loading+Image'
                            }}
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="text-white h-8 w-8" />
                        </div>
                    </div>
                ))}
                {images.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 font-medium">
                        No images yet.
                    </div>
                )}
            </div>

            {lightbox}
        </>
    )
}
