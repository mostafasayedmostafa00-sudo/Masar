import { MasarState } from '../types/masar';
import { generateDayTasks, getWeekDates } from './planner';

function toIcsDateTime(dateStr: string, hhmm: string): string {
  const [y, m, d] = dateStr.split('-');
  const [hh, mm] = hhmm.split(':');
  return `${y}${m}${d}T${hh}${mm}00`;
}

function addMinutesToIcs(dateStr: string, hhmm: string, durationMin: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + durationMin;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const endH = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const endM = String(wrapped % 60).padStart(2, '0');
  return toIcsDateTime(dateStr, `${endH}:${endM}`);
}

export function generateWeekIcs(state: MasarState, referenceDate: string): string {
  const weekDates = getWeekDates(referenceDate);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Masar OS//Personal Operating System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const date of weekDates) {
    const tasks = state.tasksByDate[date] || generateDayTasks(state, date).tasks;
    for (const task of tasks) {
      if (task.status === 'skipped') continue;
      const dtStart = toIcsDateTime(date, task.scheduledTime);
      const dtEnd = addMinutesToIcs(date, task.scheduledTime, task.estimatedMinutes);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${task.id}@masaros.local`,
        `DTSTAMP:${toIcsDateTime(date, '06:00')}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${task.title.replace(/,/g, '\\,')}`,
        `DESCRIPTION:${(task.subtitle || 'Masar OS block').replace(/,/g, '\\,')}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT10M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Start ${task.title}`,
        'END:VALARM',
        'END:VEVENT'
      );
    }
  }

  for (const ctf of state.ctfEvents) {
    const [y, m, d] = ctf.date.split('-');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ctf.id}@masaros.local`,
      `DTSTART;VALUE=DATE:${y}${m}${d}`,
      `SUMMARY:CTFtime — ${ctf.title.replace(/,/g, '\\,')}`,
      `DESCRIPTION:${(ctf.notes || ctf.url || '').replace(/,/g, '\\,')}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
