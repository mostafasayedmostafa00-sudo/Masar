import { DailyTask, Habit } from '../types/masar';

export function formatTimeHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function isInQuietHours(hhmm: string, quietStart: string, quietEnd: string): boolean {
  if (!quietStart || !quietEnd) return false;
  return quietStart > quietEnd
    ? hhmm >= quietStart || hhmm <= quietEnd
    : hhmm >= quietStart && hhmm <= quietEnd;
}

export function getDueTaskReminders(
  tasks: DailyTask[],
  activeDate: string,
  hhmm: string,
  sentKeys: Set<string>
): DailyTask[] {
  return tasks.filter((tk) => {
    if (tk.status !== 'pending' || tk.scheduledTime !== hhmm) return false;
    const key = `task:${tk.id}:${activeDate}:${hhmm}`;
    return !sentKeys.has(key);
  });
}

export function getDueHabitReminders(
  habits: Habit[],
  activeDate: string,
  hhmm: string,
  sentKeys: Set<string>
): Habit[] {
  return habits.filter((h) => {
    if (!h.reminderTime || h.reminderTime !== hhmm) return false;
    if (h.completedDates.includes(activeDate)) return false;
    const key = `habit:${h.id}:${activeDate}:${hhmm}`;
    return !sentKeys.has(key);
  });
}
