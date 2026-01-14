"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/components/I18nProvider"

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
