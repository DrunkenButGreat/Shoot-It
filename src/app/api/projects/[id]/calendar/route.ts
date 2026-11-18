import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { canAccessProject } from "@/lib/permissions";

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/([;,])/g, "\\$1");
function fold(line: string) {
  let out = "",
    size = 0;
  for (const c of line) {
    const n = Buffer.byteLength(c);
    if (size + n > 75) {
      out += "\r\n ";
      size = 1;
    }
    out += c;
    size += n;
  }
  return out;
}
export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params,
    user = (await auth())?.user?.id;
  if (!user || !(await canAccessProject(user, id)))
    return new Response(null, { status: 403 });
  const p = await prisma.project.findUniqueOrThrow({
    where: { id },
    include: {
      callsheet: { include: { scheduleItems: true } },
      appointmentSlots: true,
      planItems: { where: { done: false, due: { not: null } } },
    },
  });
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shoot-It//Project//EN",
    "CALSCALE:GREGORIAN",
  ];
  function event(
    uid: string,
    title: string,
    start: Date,
    end?: Date,
    allDay = false,
    alarm = false,
  ) {
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + uid + "@shoot-it",
      "DTSTAMP:" + stamp(new Date()),
      "SUMMARY:" + escape(title),
      allDay
        ? "DTSTART;VALUE=DATE:" + stamp(start).slice(0, 8)
        : "DTSTART:" + stamp(start),
    );
    if (end && end > start) lines.push("DTEND:" + stamp(end));
    if (alarm)
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:-P1D",
        "DESCRIPTION:" + escape(title),
        "END:VALARM",
      );
    lines.push("END:VEVENT");
  }
  if (p.date) event(id, p.name, p.date, undefined, true);
  if (p.callsheet?.callTime)
    event(
      "call-" + id,
      p.name,
      p.callsheet.callTime,
      p.callsheet.wrapTime ?? undefined,
    );
  for (const i of p.callsheet?.scheduleItems ?? [])
    event(
      i.id,
      i.activity,
      i.time,
      i.duration ? new Date(+i.time + i.duration * 60000) : undefined,
    );
  for (const a of p.appointmentSlots)
    event(a.id, p.name, a.startTime, a.endTime);
  for (const i of p.planItems)
    if (i.due) event(i.id, i.title, i.due, undefined, true, true);
  return new Response([...lines, "END:VCALENDAR", ""].map(fold).join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="shoot-it.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
