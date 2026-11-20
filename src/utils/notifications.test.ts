import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimeHHMM,
  getDueHabitReminders,
  getDueTaskReminders,
  isInQuietHours,
} from './notifications';
import { DailyTask, Habit } from '../types/masar';

test('isInQuietHours handles overnight and daytime windows correctly', () => {
  assert.equal(isInQuietHours('23:15', '22:30', '06:30'), true);
  assert.equal(isInQuietHours('05:45', '22:30', '06:30'), true);
  assert.equal(isInQuietHours('10:00', '22:30', '06:30'), false);
  assert.equal(isInQuietHours('14:00', '13:00', '15:00'), true);
  assert.equal(isInQuietHours('16:00', '13:00', '15:00'), false);
});

test('getDueHabitReminders triggers only uncompleted habits matching reminderTime once per key', () => {
  const habits: Habit[] = [
    {
      id: 'h-water',
      title: 'Water (2.5L+)',
      titleAr: 'شرب الماء',
      targetDaysLabel: '7 days',
      targetDays: 7,
      completedDates: [],
      reminderTime: '10:00',
    },
    {
      id: 'h-med',
      title: 'Meditation',
      titleAr: 'تأمل',
      targetDaysLabel: '14 days',
      targetDays: 14,
      completedDates: ['2026-11-20'],
      reminderTime: '10:00',
    },
    {
      id: 'h-clean',
      title: 'Clean eating',
      titleAr: 'أكل نظيف',
      targetDaysLabel: '21 days',
      targetDays: 21,
      completedDates: [],
    },
  ];

  const sent = new Set<string>();
  const due = getDueHabitReminders(habits, '2026-11-20', '10:00', sent);
  assert.equal(due.length, 1);
  assert.equal(due[0].id, 'h-water');

  // After marking as sent, same minute does not duplicate
  sent.add('habit:h-water:2026-11-20:10:00');
  const dueAgain = getDueHabitReminders(habits, '2026-11-20', '10:00', sent);
  assert.equal(dueAgain.length, 0);
});

test('getDueTaskReminders matches pending tasks at hhmm and deduplicates via sentKeys', () => {
  const tasks: DailyTask[] = [
    {
      id: 't-1',
      date: '2026-11-20',
      category: 'nti',
      title: 'Python for Security',
      scheduledTime: '17:30',
      estimatedMinutes: 90,
      actualMinutes: 0,
      status: 'pending',
      priority: 1,
      isScreenBased: true,
    },
  ];
  const sent = new Set<string>();
  assert.equal(getDueTaskReminders(tasks, '2026-11-20', '17:30', sent).length, 1);
  sent.add('task:t-1:2026-11-20:17:30');
  assert.equal(getDueTaskReminders(tasks, '2026-11-20', '17:30', sent).length, 0);
  assert.equal(formatTimeHHMM(new Date(2026, 10, 20, 9, 5)), '09:05');
});
