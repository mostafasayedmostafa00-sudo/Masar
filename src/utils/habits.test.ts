import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HABIT_CATEGORIES,
  buildHabitHistoryCsv,
  computeBestHabitStreak,
  computeHabitStreak,
  escapeCsvCell,
  filterHabitsByCategory,
  getHabitCategoryMeta,
  getHabitCompletionTrends,
  getHabitProgress,
  getHabitWeeklyInsights,
  getRecentHabitHistory,
  syncHabitStreaks,
} from './habits';
import { Habit } from '../types/masar';

test('computeHabitStreak counts consecutive days ending today or yesterday', () => {
  assert.equal(computeHabitStreak([], '2026-11-20'), 0);
  assert.equal(computeHabitStreak(['2026-11-18', '2026-11-19', '2026-11-20'], '2026-11-20'), 3);
  // Active streak from yesterday even before today is checked off
  assert.equal(computeHabitStreak(['2026-11-18', '2026-11-19'], '2026-11-20'), 2);
  // Broken streak if neither today nor yesterday was checked
  assert.equal(computeHabitStreak(['2026-11-17', '2026-11-18'], '2026-11-20'), 0);
});

test('computeBestHabitStreak finds longest consecutive run across completion history', () => {
  assert.equal(computeBestHabitStreak([]), 0);
  assert.equal(
    computeBestHabitStreak(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-18', '2026-11-20']),
    4
  );
});

test('syncHabitStreaks updates currentStreak and bestStreak in habit state', () => {
  const baseHabit: Habit = {
    id: 'h-sync',
    title: 'Hydration',
    titleAr: 'الماء',
    targetDaysLabel: '7 days',
    targetDays: 7,
    completedDates: ['2026-11-20', '2026-11-18', '2026-11-19', '2026-11-19'],
  };
  const synced = syncHabitStreaks(baseHabit, '2026-11-20');
  assert.deepEqual(synced.completedDates, ['2026-11-18', '2026-11-19', '2026-11-20']);
  assert.equal(synced.currentStreak, 3);
  assert.equal(synced.bestStreak, 3);

  // If a day is later missed on 2026-11-22, currentStreak resets to 0 while bestStreak stays 3
  const twoDaysLater = syncHabitStreaks(synced, '2026-11-22');
  assert.equal(twoDaysLater.currentStreak, 0);
  assert.equal(twoDaysLater.bestStreak, 3);
});

test('getHabitProgress preserves total completed days and returns 7-day history', () => {
  const habit: Habit = {
    id: 'h-test',
    title: 'Meditation',
    titleAr: 'تأمل',
    category: 'meditation',
    targetDaysLabel: '10 days',
    targetDays: 10,
    completedDates: ['2026-11-10', '2026-11-11', '2026-11-15', '2026-11-19', '2026-11-20'],
  };
  const stats = getHabitProgress(habit, '2026-11-20');
  assert.equal(stats.doneToday, true);
  assert.equal(stats.completedDays, 5);
  assert.equal(stats.streak, 2);
  assert.equal(stats.bestStreak, 2);
  assert.equal(stats.percent, 50);
  assert.equal(stats.recentHistory.length, 7);
  assert.equal(stats.recentHistory[6].date, '2026-11-20');
  assert.equal(stats.recentHistory[6].done, true);
  assert.equal(stats.recentHistory[5].done, true);
  assert.equal(stats.recentHistory[4].done, false);

  const hist = getRecentHabitHistory(habit.completedDates, '2026-11-20', 7);
  assert.equal(hist[0].date, '2026-11-14');
});

test('getHabitCompletionTrends aggregates last 7 days completions, average rate, peak day, and empty state', () => {
  const empty = getHabitCompletionTrends([], '2026-11-20', 7);
  assert.equal(empty.days.length, 7);
  assert.equal(empty.totalCompletions, 0);
  assert.equal(empty.possibleCompletions, 0);
  assert.equal(empty.averageRate, 0);
  assert.equal(empty.bestDay, null);

  const habits: Habit[] = [
    {
      id: 'h1',
      title: 'Water',
      titleAr: 'ماء',
      targetDaysLabel: '7 days',
      targetDays: 7,
      completedDates: ['2026-11-10', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-20'],
    },
    {
      id: 'h2',
      title: 'Exercise',
      titleAr: 'تمرين',
      targetDaysLabel: '7 days',
      targetDays: 7,
      completedDates: ['2026-11-19', '2026-11-20'],
    },
  ];
  const trends = getHabitCompletionTrends(habits, '2026-11-20', 7);
  assert.equal(trends.days.length, 7);
  assert.equal(trends.days[0].date, '2026-11-14');
  assert.equal(trends.days[0].completed, 0);
  assert.equal(trends.days[4].date, '2026-11-18');
  assert.equal(trends.days[4].completed, 1);
  assert.equal(trends.days[4].rate, 50);
  assert.equal(trends.days[5].completed, 2);
  assert.equal(trends.days[6].completed, 2);
  assert.equal(trends.days[6].rate, 100);
  assert.equal(trends.totalCompletions, 5);
  assert.equal(trends.possibleCompletions, 14);
  assert.equal(trends.averageRate, 36);
  assert.equal(trends.topStreak, 3);
  assert.deepEqual(trends.bestDay, { date: '2026-11-20', day: '11-20', completed: 2 });
});

test('buildHabitHistoryCsv exports escaped CSV rows for full habit history and 7-day window', () => {
  assert.equal(escapeCsvCell('Walk, "Fast"'), '"Walk, ""Fast"""');

  const emptyCsv = buildHabitHistoryCsv([], '2026-11-20', 7);
  assert.equal(
    emptyCsv,
    'date,habit_id,habit_title,habit_title_ar,category,completed,current_streak,best_streak,target_days,reminder_time,total_completed_days'
  );

  const habits: Habit[] = [
    {
      id: 'h1',
      title: 'Water, "2.5L"',
      titleAr: 'شرب الماء',
      category: 'hydration',
      reminderTime: '10:00',
      targetDaysLabel: '7 days',
      targetDays: 7,
      completedDates: ['2026-11-10', '2026-11-19', '2026-11-20'],
    },
  ];
  const csv = buildHabitHistoryCsv(habits, '2026-11-20', 7);
  const lines = csv.split('\n');
  // 1 header + 8 unique dates (2026-11-10 + 2026-11-14..2026-11-20)
  assert.equal(lines.length, 9);
  assert.equal(
    lines[1],
    '2026-11-10,h1,"Water, ""2.5L""",شرب الماء,hydration,true,2,2,7,10:00,3'
  );
  assert.equal(
    lines[2],
    '2026-11-14,h1,"Water, ""2.5L""",شرب الماء,hydration,false,2,2,7,10:00,3'
  );
  assert.equal(
    lines[8],
    '2026-11-20,h1,"Water, ""2.5L""",شرب الماء,hydration,true,2,2,7,10:00,3'
  );
});

test('habit categories provide distinct icons/metadata and filter habits accurately', () => {
  const iconKeys = HABIT_CATEGORIES.map((c) => c.iconKey);
  assert.equal(new Set(iconKeys).size, HABIT_CATEGORIES.length);

  assert.equal(getHabitCategoryMeta('health').en, 'Health');
  assert.equal(getHabitCategoryMeta('health').iconKey, 'heart');
  assert.equal(getHabitCategoryMeta('learning').en, 'Learning');
  assert.equal(getHabitCategoryMeta('learning').iconKey, 'book');
  assert.equal(getHabitCategoryMeta('productivity').en, 'Productivity');
  assert.equal(getHabitCategoryMeta('productivity').iconKey, 'zap');
  assert.equal(getHabitCategoryMeta(undefined).id, 'custom');

  const sample: Habit[] = [
    { id: '1', title: 'Run', titleAr: 'جري', category: 'health', targetDaysLabel: '7 days', targetDays: 7, completedDates: [] },
    { id: '2', title: 'Read', titleAr: 'قراءة', category: 'learning', targetDaysLabel: '7 days', targetDays: 7, completedDates: [] },
    { id: '3', title: 'Plan', titleAr: 'تخطيط', targetDaysLabel: '7 days', targetDays: 7, completedDates: [] },
  ];
  assert.equal(filterHabitsByCategory(sample, 'all').length, 3);
  assert.deepEqual(filterHabitsByCategory(sample, 'health').map((h) => h.id), ['1']);
  assert.deepEqual(filterHabitsByCategory(sample, 'learning').map((h) => h.id), ['2']);
  assert.deepEqual(filterHabitsByCategory(sample, 'custom').map((h) => h.id), ['3']);
});

test('getHabitWeeklyInsights identifies most consistent and most improved habits over last 7 days', () => {
  const empty = getHabitWeeklyInsights([], '2026-11-20', 7);
  assert.equal(empty.mostConsistent, null);
  assert.equal(empty.mostImproved, null);
  assert.equal(empty.recentTotal, 0);

  const habits: Habit[] = [
    // Sleep: 6 days prior week (11-07..11-12), 6 days this week (11-14..11-19) -> delta 0, most consistent
    {
      id: 'h-sleep',
      title: 'Sleep target met',
      titleAr: 'نوم كافٍ',
      category: 'sleep',
      targetDaysLabel: '10 days',
      targetDays: 10,
      completedDates: [
        '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12',
        '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
      ],
    },
    // Water: 1 day prior week (11-10), 5 days this week (11-16..11-20) -> delta +4, most improved
    {
      id: 'h-water',
      title: 'Water',
      titleAr: 'ماء',
      category: 'hydration',
      targetDaysLabel: '7 days',
      targetDays: 7,
      completedDates: [
        '2026-11-10',
        '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20',
      ],
    },
    // Exercise: 4 days prior week, 2 days this week -> delta -2
    {
      id: 'h-ex',
      title: 'Exercise',
      titleAr: 'تمرين',
      category: 'exercise',
      targetDaysLabel: '21 days',
      targetDays: 21,
      completedDates: [
        '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11',
        '2026-11-18', '2026-11-20',
      ],
    },
  ];

  const insights = getHabitWeeklyInsights(habits, '2026-11-20', 7);
  assert.equal(insights.recentTotal, 13);
  assert.equal(insights.previousTotal, 11);
  assert.equal(insights.overallDelta, 2);
  assert.equal(insights.activeHabitsCount, 3);
  assert.equal(insights.mostConsistent?.habit.id, 'h-sleep');
  assert.equal(insights.mostConsistent?.recentCount, 6);
  assert.equal(insights.mostConsistent?.rate, 86);
  assert.equal(insights.mostImproved?.habit.id, 'h-water');
  assert.equal(insights.mostImproved?.delta, 4);

  // When all habits decline vs prior week, mostImproved is null while mostConsistent remains populated
  const regressed = getHabitWeeklyInsights([habits[2]], '2026-11-20', 7);
  assert.equal(regressed.mostConsistent?.habit.id, 'h-ex');
  assert.equal(regressed.mostImproved, null);
});



