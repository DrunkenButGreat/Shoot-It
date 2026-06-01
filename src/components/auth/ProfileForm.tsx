"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/components/I18nProvider"
import ImageUpload from "@/components/moodboard/ImageUpload"
import { X, Palette } from "lucide-react"

export function ProfileForm() {
    const { t } = useI18n()
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        role: "",
        bio: "",
        brandingColor: "",
        brandingImage: "",
    })

    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoading(true)
            try {
                const response = await fetch("/api/user/profile")
                if (response.ok) {
                    const data = await response.json()
                    setFormData({
                        name: data.name || "",
                        email: data.email || "",
                        phone: data.phone || "",
                        role: data.role || "",
                        bio: data.bio || "",
                        brandingColor: data.brandingColor || "",
                        brandingImage: data.brandingImage || "",
                    })
                }
            } catch (error) {
                console.error("Failed to fetch profile:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchProfile()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSaving(true)

        try {
            const response = await fetch("/api/user/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            })

            if (response.ok) {
                alert(t('auth.profileUpdated'))
            } else {
                const error = await response.json()
                alert(error.error || t('common.error'))
            }
        } catch (error) {
            alert(t('auth.errorOccurred'))
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 text-premium">{t('auth.loadingProfile')}</div>
    }

    return (
        <Card className="max-w-2xl mx-auto border-none shadow-premium bg-white/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    {t('auth.profileTitle')}
                </CardTitle>
                <CardDescription>
                    {t('auth.profileDescription')}
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="email" className="text-gray-600">{t('auth.email')} {t('auth.notChangeable')}</Label>
                        <Input
                            id="email"
                            value={formData.email}
                            disabled
                            className="bg-gray-50 border-gray-200"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-gray-700 font-medium">{t('auth.name')} *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder={t('auth.namePlaceholder')}
                            required
                            className="border-gray-200 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="role" className="text-gray-700 font-medium">{t('auth.standardRole')}</Label>
                        <Input
                            id="role"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            placeholder={t('auth.rolePlaceholder')}
                            className="border-gray-200 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="phone" className="text-gray-700 font-medium">{t('auth.phoneNumber')}</Label>
                        <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder={t('auth.phonePlaceholder')}
                            className="border-gray-200 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="bio" className="text-gray-700 font-medium">{t('auth.bio')}</Label>
                        <Textarea
                            id="bio"
                            value={formData.bio}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, bio: e.target.value })}
                            placeholder={t('auth.bioPlaceholder')}
                            rows={4}
                            className="border-gray-200 focus:ring-blue-500"
                        />
                    </div>

                    <div className="pt-6 border-t border-gray-100">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">{t('profile.branding')}</h3>
                        <p className="text-sm text-gray-500 mb-6">{t('profile.brandingDescription')}</p>

                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label className="text-gray-700 font-medium">{t('profile.primaryColor')}</Label>
                                <div className="flex gap-2 items-center">
                                    <div className="relative">
                                        <Input 
                                            type="color" 
                                            value={formData.brandingColor}
                                            onChange={(e) => setFormData({...formData, brandingColor: e.target.value})}
                                            className="w-12 h-12 p-1 rounded-md cursor-pointer border-gray-200"
                                        />
                                    </div>
                                    <Input 
                                        value={formData.brandingColor}
                                        onChange={(e) => setFormData({...formData, brandingColor: e.target.value})}
                                        placeholder="#000000"
                                        className="font-mono w-32 border-gray-200"
                                    />
                                    {formData.brandingColor && (
                                        <Button 
                                            type="button"
                                            variant="ghost" 
                                            size="sm"
                                            onClick={() => setFormData({...formData, brandingColor: ""})}
                                        >
                                            Reset
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label className="text-gray-700 font-medium">{t('profile.brandingImage')}</Label>
                                <div className="space-y-4">
                                    {formData.brandingImage && (
                                        <div className="relative group w-full h-48 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                                            <img src={formData.brandingImage} alt="Banner" className="w-full h-full object-cover" />
                                            <button
                                                type="button" 
                                                onClick={() => setFormData({...formData, brandingImage: ""})}
                                                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                    <ImageUpload
                                        uploadUrl="/api/user/branding"
                                        onSuccess={(data: any) => {
                                            if (data?.url) setFormData(prev => ({...prev, brandingImage: data.url}))
                                        }}
                                        label={t('profile.uploadBanner')}
                                        maxSize={5 * 1024 * 1024}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-gray-400">{t('profile.brandingImageHelp')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-4 border-t border-gray-100 pt-6">
                    <Button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                    >
                        {isSaving ? t('auth.savingProfile') : t('auth.saveProfile')}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
