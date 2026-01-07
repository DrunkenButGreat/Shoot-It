'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScheduleForm } from './ScheduleForm';

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
      <Card>
        <CardHeader>
          <CardTitle>Callsheet Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="shootDate">Shoot Date</Label>
            <Input
              id="shootDate"
              type="date"
              value={shootDate}
              onChange={(e) => setShootDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Studio A, 123 Main St"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="callTime">Call Time</Label>
            <Input
              id="callTime"
              value={callTime}
              onChange={(e) => setCallTime(e.target.value)}
              placeholder="09:00 AM"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              className="w-full min-h-[100px] px-3 py-2 border rounded-md"
            />
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Callsheet'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Schedule</CardTitle>
            <Button onClick={() => setIsScheduleFormOpen(true)}>
              Add Schedule Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {callsheet?.scheduleItems && callsheet.scheduleItems.length > 0 ? (
            <div className="space-y-2">
              {callsheet.scheduleItems.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{item.time} - {item.activity}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No schedule items yet. Add your first item!</p>
          )}
        </CardContent>
      </Card>

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
