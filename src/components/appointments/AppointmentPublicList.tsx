'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, Calendar as CalendarIcon, Check, X } from 'lucide-react'
import { useI18n } from '@/components/I18nProvider'

interface Slot {
    id: string
    startTime: string
    endTime: string
}

interface AppointmentPublicListProps {
    slots: Slot[]
    locale: string
}

export function AppointmentPublicList({ slots, locale }: AppointmentPublicListProps) {
    const { dictionary: dict } = useI18n()

    if (slots.length === 0) {
        return (
            <div className="text-center py-12 bg-white/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-gray-200">
                <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">{dict.project.noAppointmentsSet || 'Noch keine Terminvorschläge vorhanden.'}</p>
            </div>
        )
    }

    // Group slots by day
    const groupedSlots = slots.reduce((acc: any, slot) => {
        const date = new Date(slot.startTime).toDateString()
        if (!acc[date]) acc[date] = []
        acc[date].push(slot)
        return acc
    }, {})

    // Sort dates
    const sortedDates = Object.keys(groupedSlots).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

    return (
        <div className="space-y-8">
            {sortedDates.map((dateStr) => (
                <div key={dateStr} className="space-y-4">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest px-2">
                        {new Date(dateStr).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {groupedSlots[dateStr].sort((a: Slot, b: Slot) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map((slot: any) => (
                            <Card key={slot.id} className="border-none shadow-md bg-white/80 backdrop-blur-sm overflow-hidden hover:shadow-lg transition-all group">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="shrink-0 flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-1 bg-green-500/10 text-green-700 px-2 py-0.5 rounded-full border border-green-500/20 text-[10px] font-bold">
                                            <Check className="h-2.5 w-2.5" />
                                            <span>{(slot.responses || []).filter((r: any) => r.status === 'ACCEPTED').length}</span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-red-500/10 text-red-700 px-2 py-0.5 rounded-full border border-red-500/20 text-[10px] font-bold">
                                            <X className="h-2.5 w-2.5" />
                                            <span>{(slot.responses || []).filter((r: any) => r.status === 'REJECTED').length}</span>
                                        </div>
                                    </div>
                                    <div className="w-px h-10 bg-gray-100 mx-2" />
                                    <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-gray-900">
                                            {new Date(slot.startTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.endTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{dict.project.availableTime || 'Verfügbarer Zeitraum'}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
