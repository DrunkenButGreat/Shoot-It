"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Share, Check } from "lucide-react"
import { useI18n } from "@/components/I18nProvider"
import Link from "next/link"

interface Rating {
  id: string
  stars: number | null
  color: string | null
}

interface SelectionImage {
  id: string
  filename: string
  path: string
  thumbnail: string | null
  ratings: Rating[]
}

interface ExportDialogProps {
  images: SelectionImage[]
}

type ExportType = 'CAPTURE_ONE' | 'LIGHTROOM' | 'FINDER_EXPLORER'

export function ExportDialog({ images }: ExportDialogProps) {
  const { t } = useI18n()
  const [exportType, setExportType] = useState<ExportType>('CAPTURE_ONE')
  const [copied, setCopied] = useState(false)

  const getBaseName = (filename: string) => {
    return filename.split('.').slice(0, -1).join('.') || filename
  }

  const exportText = useMemo(() => {
    const filenames = images.map(img => img.filename)
    
    switch (exportType) {
      case 'CAPTURE_ONE':
        // Capture One typically uses spaces to search for multiple filenames (without extensions)
        return images.map(img => getBaseName(img.filename)).join(' ')
      case 'LIGHTROOM':
        // Lightroom typically uses commas for its search bar
        return images.map(img => getBaseName(img.filename)).join(', ')
      case 'FINDER_EXPLORER':
        // For Finder/Explorer, filenames with extensions are usually better
        return filenames.join('\n')
      default:
        return ''
    }
  }, [images, exportType])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exportText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (images.length === 0) return null

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share className="h-4 w-4" />
          {t('selection.exportTitle')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{t('selection.exportTitle')}</DialogTitle>
          <div className="text-[15px] leading-relaxed text-gray-700 mt-4">
            {t('selection.exportDescription')} 
            <p className="mt-2 text-sm text-gray-500">
              {t('selection.faqNote')} <Link href="/faq" className="text-orange-500 font-medium cursor-pointer hover:underline">{t('selection.faqLink')}</Link>.
            </p>
          </div>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="application" className="text-sm font-bold">{t('selection.app')}</Label>
            <select
              id="application"
              className="flex h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-all appearance-none cursor-pointer"
              value={exportType}
              onChange={(e) => setExportType(e.target.value as ExportType)}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 1rem center',
                backgroundSize: '1.2em'
              }}
            >
              <option value="CAPTURE_ONE">{t('selection.captureOne')}</option>
              <option value="LIGHTROOM">{t('selection.lightroom')}</option>
              <option value="FINDER_EXPLORER">{t('selection.finder')}</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="searchtext" className="text-sm font-bold">{t('selection.searchText')}</Label>
            <Textarea
              id="searchtext"
              readOnly
              value={exportText}
              className="font-mono text-sm h-[180px] resize-none bg-white border-2 border-slate-200 rounded-xl p-4 focus:ring-0"
            />
            <p className="text-[12px] text-gray-400">{t('selection.copySnippet')}</p>
          </div>
        </div>

        <DialogFooter className="sm:justify-between items-center gap-4 py-4 pt-2">
          <DialogClose asChild>
            <Button variant="outline" className="h-12 px-8 rounded-xl border-2 border-slate-200 font-bold hover:bg-slate-50 transition-all">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button 
            onClick={copyToClipboard}
            className={`h-12 px-8 rounded-xl font-bold transition-all duration-300 shadow-sm grow sm:grow-0 min-w-[240px] ${
              copied 
                ? 'bg-green-500 hover:bg-green-600 text-white' 
                : 'bg-[#fcd34d] hover:bg-[#fbbf24] text-black'
            }`}
          >
            {copied ? (
              <>
                <Check className="h-5 w-4 mr-2" />
                {t('selection.copied')}
              </>
            ) : (
              <>
                {t('selection.copyToClipboard')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
