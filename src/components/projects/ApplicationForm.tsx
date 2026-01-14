"use client"

import { useState, useRef, useEffect } from "react"
import { useI18n } from "@/components/I18nProvider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Send, Upload, X, CheckCircle2 } from "lucide-react"

interface ApplicationFormProps {
  projectId: string
  projectName: string
  initialData?: {
    name?: string
    email?: string
  }
}

export function ApplicationForm({ projectId, projectName, initialData }: ApplicationFormProps) {
  const { t } = useI18n()
  const MAX_IMAGES = 10 // Could be dynamic if passed from props
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    email: initialData?.email || "",
    role: "",
    message: "",
    portfolioUrl: "",
    instagramUrl: "",
  })

  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      // Check max limit
      if (files.length + newFiles.length > MAX_IMAGES) {
        alert(t('applications.maxImagesError').replace('{count}', MAX_IMAGES.toString()))
        return
      }
      setFiles([...files, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      // Get ReCAPTCHA token
      let token = ""
      if (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
        // @ts-ignore
        token = await window.grecaptcha.execute(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY, { action: 'application' })
      }

      const submitData = new FormData()
      submitData.append('name', formData.name)
      submitData.append('email', formData.email)
      submitData.append('role', formData.role)
      submitData.append('message', formData.message)
      submitData.append('portfolioUrl', formData.portfolioUrl)
      submitData.append('instagramUrl', formData.instagramUrl)
      submitData.append('recaptchaToken', token)

      files.forEach((file) => {
        submitData.append('images', file)
      })

      const response = await fetch(`/api/projects/${projectId}/applications`, {
        method: 'POST',
        body: submitData,
      })

      if (response.ok) {
        setIsSuccess(true)
        setTimeout(() => {
          setOpen(false)
          setIsSuccess(false)
          setFormData({
            name: initialData?.name || "",
            email: initialData?.email || "",
            role: "",
            message: "",
            portfolioUrl: "",
            instagramUrl: "",
          })
          setFiles([])
        }, 3000)
      } else {
        const data = await response.json()
        setError(data.error || "Something went wrong")
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Load ReCAPTCHA script
    if (open && typeof window !== 'undefined' && !window.hasOwnProperty('grecaptcha')) {
      const script = document.createElement('script')
      script.src = `https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`
      script.async = true
      document.body.appendChild(script)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-6 h-auto transition-all shadow-lg hover:shadow-blue-600/20 gap-2">
          <Send className="h-4 w-4" />
          {t('applications.applyNow')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        {isSuccess ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">{t('applications.successTitle')}</h3>
              <p className="text-gray-500">{t('applications.successMessage')}</p>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('applications.applyFor')} {projectName}</DialogTitle>
              <DialogDescription>
                {t('applications.formDescription')}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('applications.name')}</Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('applications.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              {!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
                <div className="p-3 rounded-lg bg-amber-50 text-amber-700 text-[10px] border border-amber-100 italic">
                  {t('applications.recaptchaMissingPublicWarning')}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="role">{t('applications.role')}</Label>
                <Input
                  id="role"
                  required
                  placeholder={t('applications.rolePlaceholder')}
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">{t('applications.message')}</Label>
                <Textarea
                  id="message"
                  required
                  rows={4}
                  placeholder={t('applications.messagePlaceholder')}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="portfolioUrl">{t('applications.portfolioUrl')}</Label>
                  <Input
                    id="portfolioUrl"
                    placeholder="https://..."
                    value={formData.portfolioUrl}
                    onChange={(e) => setFormData({ ...formData, portfolioUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagramUrl">{t('applications.instagramUrl')}</Label>
                  <Input
                    id="instagramUrl"
                    placeholder="@username"
                    value={formData.instagramUrl}
                    onChange={(e) => setFormData({ ...formData, instagramUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('applications.portfolioImages')}</Label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                >
                  <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-600">{t('applications.uploadImages')}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{t('applications.imageConstraints')}</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>

                {files.length > 0 && (
                  <div className="grid grid-cols-5 gap-2 mt-4">
                    {files.map((file, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt="preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <X className="h-4 w-4 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs font-bold border border-red-100">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 h-auto rounded-xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('applications.sending')}
                  </>
                ) : (
                  t('applications.submit')
                )}
              </Button>
              <p className="text-[9px] text-gray-400 text-center">
                This site is protected by reCAPTCHA and the Google{' '}
                <a href="https://policies.google.com/privacy" className="underline">Privacy Policy</a> and{' '}
                <a href="https://policies.google.com/terms" className="underline">Terms of Service</a> apply.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
