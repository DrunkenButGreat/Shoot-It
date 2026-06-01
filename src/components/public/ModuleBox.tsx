"use client"

import Link from "next/link"

interface ModuleBoxProps {
    title: string
    icon: React.ReactNode
    count: number
    label: string
    href: string
    disabled: boolean
    dict: any
    brandColor?: string | null
}

export function ModuleBox({ title, icon, count, label, href, disabled, dict, brandColor }: ModuleBoxProps) {
    const content = (
        <div 
            className={`p-4 rounded-2xl border transition-all ${disabled ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100 hover:shadow-lg hover:-translate-y-1'}`}
            style={!disabled && brandColor ? { '--hover-border-color': brandColor, transition: 'all 0.2s' } as React.CSSProperties : undefined}
             onMouseEnter={(e) => { if(!disabled && brandColor) e.currentTarget.style.borderColor = brandColor }}
             onMouseLeave={(e) => { if(!disabled && brandColor) e.currentTarget.style.borderColor = '#f3f4f6' }} // gray-100
        >
            <div className="flex items-start justify-between mb-4">
                <div 
                    className={`p-2 rounded-xl ${disabled ? 'bg-gray-200 text-gray-400' : 'bg-blue-50 text-blue-600'}`}
                    style={!disabled && brandColor ? { 
                        backgroundColor: `${brandColor}1A`, // 10% opacity
                        color: brandColor 
                    } : undefined}
                >
                    {icon}
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black text-gray-900">{count}</p>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">{label}</p>
                </div>
            </div>
            <h3 className="font-bold text-gray-800">{title}</h3>
            {disabled && <p className="text-[10px] text-gray-400 mt-1 italic">{dict.publicProject.loginRequired}</p>}
        </div>
    )

    if (disabled) return content
    return <Link href={href}>{content}</Link>
}
