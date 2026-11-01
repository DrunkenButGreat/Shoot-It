"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/I18nProvider"

export function GalleryLoadMore({ onLoadMore, className }: {
    onLoadMore: () => void
    className?: string
}) {
    const buttonRef = useRef<HTMLButtonElement>(null)
    const { t } = useI18n()

    useEffect(() => {
        if (!buttonRef.current || typeof IntersectionObserver === "undefined") return

        let active = true
        const observer = new IntersectionObserver((entries) => {
            if (!active || !entries.some(entry => entry.isIntersecting)) return
            active = false
            observer.disconnect()
            onLoadMore()
        }, { rootMargin: "600px 0px" })
        observer.observe(buttonRef.current)

        return () => {
            active = false
            observer.disconnect()
        }
    }, [onLoadMore])

    return (
        <Button ref={buttonRef} type="button" variant="outline" className={className} onClick={onLoadMore}>
            {t("common.loadMore")}
        </Button>
    )
}
