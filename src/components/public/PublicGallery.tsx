"use client"

import { OriginalImageButton } from "@/components/OriginalImageButton"

import { imagePreviewSource } from "@/lib/image-preview"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X, ChevronLeft, ChevronRight, ZoomIn, Play } from "lucide-react"

interface Image {
    id: string
    path: string
    filename: string
    thumbnail?: string | null
    width?: number | null
    height?: number | null
    isVideo?: boolean
    duration?: number | null
}

function formatDuration(seconds: number): string {
    const total = Math.round(seconds)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, "0")}`
}

// Renders a public gallery item as an image or a hover-playable video.
function PublicMedia({ image, className }: { image: Image; className: string }) {
    const videoRef = useRef<HTMLVideoElement>(null)

    if (image.isVideo) {
        return (
            <>
                <video
                    ref={videoRef}
                    src={`${image.path}#t=0.1`}
                    poster={image.thumbnail || undefined}
                    muted
                    loop
                    playsInline
                    preload="none"
                    className={className}
                    draggable={false}
                    onMouseEnter={() => videoRef.current?.play().catch(() => {})}
                    onMouseLeave={() => {
                        const v = videoRef.current
                        if (v) { v.pause(); v.currentTime = 0 }
                    }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity duration-200">
                    <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
                        <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                </div>
                {image.duration ? (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-medium px-1.5 py-0.5 rounded pointer-events-none">
                        {formatDuration(image.duration)}
                    </div>
                ) : null}
            </>
        )
    }

    return (
        <img
            src={imagePreviewSource(image)}
            alt={image.filename}
            loading="lazy"
            decoding="async"
            className={className}
            onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Error+Loading+Image'
            }}
        />
    )
}

interface PublicGalleryProps {
    images: Image[]
    columns?: number // Not used for justified
    aspectRatio?: "square" | "portrait"
    layout?: "grid" | "masonry" | "columns" | "justified"
}

export function PublicGallery({
    images,
    aspectRatio = "square",
    layout = "masonry"
}: PublicGalleryProps) {
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
                <div className="min-w-0 flex-1 text-white/80">
                    <p className="truncate text-sm font-bold uppercase tracking-widest">{images[selectedIndex].filename}</p>
                    <p className="text-xs text-white/50">{selectedIndex + 1} / {images.length}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                <OriginalImageButton image={images[selectedIndex]} />
                <button
                    className="p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-2xl transition-all shadow-xl backdrop-blur-md border border-white/10"
                    onClick={closeLightbox}
                >
                    <X className="h-6 w-6" />
                </button>
                </div>
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
                {images[selectedIndex].isVideo ? (
                    <video
                        src={images[selectedIndex].path}
                        poster={images[selectedIndex].thumbnail || undefined}
                        controls
                        autoPlay
                        playsInline
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-500"
                    />
                ) : (
                    <img
                        src={imagePreviewSource(images[selectedIndex])}
                        alt={images[selectedIndex].filename}
                        className="max-w-full max-h-full object-contain shadow-2xl rounded-lg animate-in zoom-in-95 duration-500"
                    />
                )}
            </div>
        </div>,
        document.body
    ) : null

    return (
        <>
            {layout === "grid" ? (
                <div className="shootit-gallery-grid">
                    {images.map((image, index) => (
                        <div
                            key={image.id}
                            className={`shootit-gallery-media relative rounded-xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all border border-gray-100 bg-gray-50`}
                            onClick={() => openLightbox(index)}
                        >
                            <PublicMedia
                                image={image}
                                className="object-contain w-full h-auto"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="text-white h-8 w-8" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : layout === "columns" ? (
                <div className="shootit-gallery-masonry">
                    {images.map((image, index) => (
                        <div
                            key={image.id}
                            className="shootit-gallery-media relative break-inside-avoid rounded-xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all border border-gray-100 bg-gray-50 mb-4"
                            onClick={() => openLightbox(index)}
                        >
                            <PublicMedia
                                image={image}
                                className="w-full h-auto block"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="text-white h-8 w-8" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : layout === "justified" ? (
                /* Justified Layout (Google Photos style) */
                <div className="shootit-gallery-justified">
                    {images.map((image, index) => {
                        // Use stored dimensions or fallback to 4:3
                        const width = image.width || 400
                        const height = image.height || 300
                        const aspect = width / height

                        return (
                            <div
                                key={image.id}
                                className="shootit-gallery-item shootit-gallery-media relative rounded-xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all border border-gray-100 bg-gray-50 mb-0"
                                style={{
                                    flexGrow: aspect * 100,
                                    flexBasis: `${aspect * 180}px`,
                                    height: 'var(--gallery-preview-height)'
                                }}
                                onClick={() => openLightbox(index)}
                            >
                                <PublicMedia
                                    image={image}
                                    className="w-full h-full object-contain block"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ZoomIn className="text-white h-8 w-8" />
                                </div>
                            </div>
                        )
                    })}
                    {/* Add invisible items to prevent the last row from stretching too much */}
                    <div className="flex-[1000] h-0" />
                </div>
            ) : (
                <div className="shootit-gallery-masonry">
                    {images.map((image, index) => (
                        <div
                            key={image.id}
                            className="shootit-gallery-media relative break-inside-avoid rounded-xl overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all border border-gray-100 bg-gray-50"
                            onClick={() => openLightbox(index)}
                        >
                            <PublicMedia image={image} className="w-full h-auto block" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="text-white h-8 w-8" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {images.length === 0 && (
                <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl text-gray-400 font-medium">
                    No images yet.
                </div>
            )}

            {lightbox}
        </>
    )
}
