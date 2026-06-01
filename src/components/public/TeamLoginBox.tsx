"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

interface TeamLoginBoxProps {
    shortCode: string
    dict: any
    brandColor?: string | null
}

export function TeamLoginBox({ shortCode, dict, brandColor }: TeamLoginBoxProps) {
    return (
        <div 
            className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4"
            style={brandColor ? { 
                backgroundImage: `linear-gradient(to right, ${brandColor}1A, ${brandColor}0D)`, 
                borderColor: `${brandColor}33` 
            } : undefined}
        >
            <div>
                <h4 
                    className="font-bold text-blue-900 text-lg"
                    style={brandColor ? { color: brandColor, filter: 'brightness(0.6)' } : undefined}
                >
                    {dict.publicProject.areYouTeam}
                </h4>
                <p 
                    className="text-blue-700 text-sm"
                    style={brandColor ? { color: brandColor, filter: 'brightness(0.8)' } : undefined}
                >
                    {dict.publicProject.loginToAccess}
                </p>
            </div>
            <Link href={`/login?callbackUrl=/p/${shortCode}`}>
                <Button 
                    className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                    style={brandColor ? { backgroundColor: brandColor } : undefined} 
                    onMouseEnter={(e) => { if (brandColor) e.currentTarget.style.filter = 'brightness(0.9)' }}
                    onMouseLeave={(e) => { if (brandColor) e.currentTarget.style.filter = 'brightness(1)' }}
                >
                    {dict.auth.signIn}
                </Button>
            </Link>
        </div>
    )
}
