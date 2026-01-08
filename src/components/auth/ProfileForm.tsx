"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export function ProfileForm() {
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
                alert("Profil erfolgreich aktualisiert!")
            } else {
                const error = await response.json()
                alert(error.error || "Fehler beim Speichern")
            }
        } catch (error) {
            alert("Ein Fehler ist aufgetreten")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 text-premium">Lade Profil...</div>
    }

    return (
        <Card className="max-w-2xl mx-auto border-none shadow-premium bg-white/80 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Mein Participant-Profil
                </CardTitle>
                <CardDescription>
                    Fülle dein Profil aus, damit deine Daten automatisch in Projekte übernommen werden.
                </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6">
                    <div className="grid gap-2">
                        <Label htmlFor="email" className="text-gray-600">Email (nicht änderbar)</Label>
                        <Input
                            id="email"
                            value={formData.email}
                            disabled
                            className="bg-gray-50 border-gray-200"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-gray-700 font-medium">Name *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Dein Name"
                            required
                            className="border-gray-200 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="role" className="text-gray-700 font-medium">Standard-Rolle</Label>
                        <Input
                            id="role"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            placeholder="z.B. Model, Fotograf, MUA..."
                            className="border-gray-200 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="phone" className="text-gray-700 font-medium">Telefonnummer</Label>
                        <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+49 123 456789"
                            className="border-gray-200 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="bio" className="text-gray-700 font-medium">Bio / Notizen</Label>
                        <Textarea
                            id="bio"
                            value={formData.bio}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, bio: e.target.value })}
                            placeholder="Erzähle etwas über dich oder füge wichtige Infos hinzu..."
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
                        {isSaving ? "Speichert..." : "Profil speichern"}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
