'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScheduleForm } from './ScheduleForm';
import { Save, Plus, Clock, MapPin, Calendar, Info } from 'lucide-react';
import { useI18n } from '@/components/I18nProvider';

type Callsheet = {
  id: string;
  // shootDate: Date | null; // Removed as not in schema
  locationName: string | null;
  locationAddress: string | null;
  callTime: Date | null;
  additionalNotes: string | null;
  // Schema has: locationName, locationAddress, locationNotes, parkingInfo, emergencyContact, emergencyPhone, weatherInfo, dresscode, equipmentList, additionalNotes
  // Let's coerce for now to satisfy basic build, assuming generic usage
  // We will map 'location' to 'locationName' in key

  scheduleItems: {
    id: string;
    time: string;
    activity: string;
  }[];
} | null;

export function CallsheetContent({
  projectId,
  initialCallsheet
}: {
  projectId: string;
  initialCallsheet: Callsheet;
}) {
  const [callsheet, setCallsheet] = useState(initialCallsheet);
  const [shootDate, setShootDate] = useState(initialCallsheet?.callTime ? new Date(initialCallsheet.callTime).toISOString().split('T')[0] : '');
  const [location, setLocation] = useState(initialCallsheet?.locationName || '');
  const [callTime, setCallTime] = useState(initialCallsheet?.callTime ? new Date(initialCallsheet.callTime).toTimeString().substring(0, 5) : '');
  const [notes, setNotes] = useState(initialCallsheet?.additionalNotes || '');
  const [isScheduleFormOpen, setIsScheduleFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useI18n();

  const refreshCallsheet = async () => {
    const response = await fetch(`/api/projects/${projectId}/callsheet`);
    if (response.ok) {
      const data = await response.json();
      setCallsheet(data);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/callsheet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shootDate: shootDate || null,
          location: location || null,
          callTime: callTime || null,
          notes: notes || null,
        }),
      });

      if (response.ok) {
        await refreshCallsheet();
      }
    } catch (error) {
      console.error('Failed to save callsheet:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {t('callsheet.title')}
          </h2>
          <p className="text-sm text-gray-500 mt-1 italic">{t('callsheet.subtitle')}</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2 shadow-sm">
          <Save className="h-4 w-4" />
          {isSaving ? t('common.saving') : t('common.saveChanges')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Details */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-md bg-white/90 backdrop-blur-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                {t('callsheet.details')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="grid gap-2">
                <Label htmlFor="shootDate" className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {t('callsheet.date')}
                </Label>
                <Input
                  id="shootDate"
                  type="date"
                  value={shootDate}
                  onChange={(e) => setShootDate(e.target.value)}
                  className="rounded-xl border-slate-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location" className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  {t('callsheet.location')}
                </Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Studio A, 123 Main St"
                  className="rounded-xl border-slate-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="callTime" className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  Call Time
                </Label>
                <Input
                  id="callTime"
                  value={callTime}
                  onChange={(e) => setCallTime(e.target.value)}
                  placeholder="09:00"
                  className="rounded-xl border-slate-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes" className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Info className="h-3 w-3" />
                  {t('callsheet.notesTitle')}
                </Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('callsheet.notesPlaceholder')}
                  className="w-full min-h-[120px] px-3 py-2 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Schedule */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-md bg-white/90 backdrop-blur-sm h-full overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  {t('callsheet.schedule')}
                </CardTitle>
                <Button onClick={() => setIsScheduleFormOpen(true)} size="sm" variant="outline" className="gap-2 rounded-xl">
                  <Plus className="h-3 w-3" />
                  {t('callsheet.addItem')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {callsheet?.scheduleItems && callsheet.scheduleItems.length > 0 ? (
                <div className="space-y-3">
                  {callsheet.scheduleItems.map((item) => (
                    <div key={item.id} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:border-blue-100 hover:bg-white transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                          {item.time}
                        </div>
                        <div className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                          {item.activity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center bg-slate-50/30 rounded-2xl border-2 border-dashed border-slate-200">
                  <p className="text-slate-400 font-medium italic">{t('callsheet.noItems')}</p>
                  <Button onClick={() => setIsScheduleFormOpen(true)} variant="link" className="mt-2 text-blue-600 font-bold">
                    {t('callsheet.createFirst')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ScheduleForm
        projectId={projectId}
        isOpen={isScheduleFormOpen}
        onClose={() => setIsScheduleFormOpen(false)}
        onSuccess={() => {
          setIsScheduleFormOpen(false);
          refreshCallsheet();
        }}
      />
    </div>
  );
}
