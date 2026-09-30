import { NextResponse } from "next/server";
import { appointmentAvailabilityQuerySchema } from "@/lib/validation";
import { getAvailability } from "@/lib/appointments";

export const maxDuration = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = appointmentAvailabilityQuerySchema.safeParse({
    date: searchParams.get("date") ?? "",
    duration: searchParams.get("duration") ?? undefined,
    property_id: searchParams.get("property_id") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { date, duration } = parsed.data;
  const result = await getAvailability(date, duration);
  return NextResponse.json(
    {
      date,
      duration,
      slots: result.slots,
      work_hours: result.schedule.work_hours,
      buffer_minutes: result.schedule.buffer_minutes,
    },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    }
  );
}
