"use client";

import { useState } from "react";
import AppointmentCalendar from "@/components/AppointmentCalendar";
import AppointmentForm from "@/components/AppointmentForm";

export default function ContactTabs({
  propertyId,
  allowedDurations,
  defaultDuration,
  scheduleLabel,
  bufferMinutes,
}: {
  propertyId: string | null;
  allowedDurations: number[];
  defaultDuration: number;
  scheduleLabel: string;
  bufferMinutes: number;
}) {
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [duration, setDuration] = useState(defaultDuration);

  return (
    <div className="space-y-6 animate-[fadeIn_0.25s_ease-out]">
      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-gutter items-start">
        <AppointmentCalendar
          duration={duration}
          onSelect={setSelectedIso}
          selectedIso={selectedIso}
          scheduleLabel={scheduleLabel}
          bufferMinutes={bufferMinutes}
        />
        <div className="xl:sticky xl:top-28">
          <AppointmentForm
            propertyId={propertyId}
            selectedIso={selectedIso}
            duration={duration}
            onDurationChange={(nextDuration) => {
              setDuration(nextDuration);
              setSelectedIso(null);
            }}
            allowedDurations={allowedDurations}
          />
        </div>
      </div>

      <style>{`@keyframes fadeIn { from { opacity:0; transform: translateY(4px);} to {opacity:1; transform:translateY(0);} }`}</style>
    </div>
  );
}
