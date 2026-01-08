"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Copy, ExternalLink, Globe, Lock } from "lucide-react"
import { useState } from "react"
import Link from "next/link"

interface PublicLinkCardProps {
    project: {
        shortCode: string
        isPublic: boolean
        owner: {
            name: string | null
            email: string | null
        }
    }
}

export function PublicLinkCard({ project }: PublicLinkCardProps) {
    const [copied, setCopied] = useState(false)
    const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${project.shortCode}` : `/p/${project.shortCode}`

    const copyToClipboard = () => {
        navigator.clipboard.writeText(publicUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Card className="border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Project Access</CardTitle>
                    {project.isPublic ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                            <Globe className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase">Public</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                            <Lock className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase">Private</span>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Owner</label>
                    <p className="text-sm font-medium text-gray-900">{project.owner.name || project.owner.email}</p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Public Link</label>
                        <Link
                            href={`/p/${project.shortCode}`}
                            target="_blank"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                            Open <ExternalLink className="h-3 w-3" />
                        </Link>
                    </div>
                    <div className="flex items-center gap-2 group">
                        <code className="flex-1 text-[11px] bg-gray-50 border border-gray-100 px-3 py-2.5 rounded-xl text-blue-600 font-mono truncate transition-colors group-hover:bg-blue-50/30 group-hover:border-blue-100">
                            {publicUrl}
                        </code>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={copyToClipboard}
                            className="h-10 w-10 shrink-0 rounded-xl transition-all active:scale-95"
                        >
                            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {!project.isPublic && (
                    <p className="text-[11px] text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-100 leading-relaxed italic">
                        <strong>Note:</strong> Public access is currently disabled. Only team members can access this project via login.
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
