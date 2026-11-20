import { Habit, HabitCategory } from '../types/masar';
import { addDays } from './planner';

export type HabitIconKey =
  | 'heart'
  | 'book'
  | 'zap'
  | 'dumbbell'
  | 'droplets'
  | 'brain'
  | 'moon'
  | 'apple'
  | 'sparkles'
  | 'tag';

export interface HabitCategoryMeta {
  id: HabitCategory;
  en: string;
  ar: string;
  iconKey: HabitIconKey;
  badgeClass: string;
  iconClass: string;
}

export const HABIT_CATEGORIES: HabitCategoryMeta[] = [
  {
    id: 'health',
    en: 'Health',
    ar: 'الصحة',
    iconKey: 'heart',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'learning',
    en: 'Learning',
    ar: 'التعلّم',
    iconKey: 'book',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/25',
    iconClass: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    id: 'productivity',
    en: 'Productivity',
    ar: 'الإنتاجية',
    iconKey: 'zap',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'exercise',
    en: 'Exercise',
    ar: 'التمارين',
    iconKey: 'dumbbell',
    badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/25',
    iconClass: 'text-orange-600 dark:text-orange-400',
  },
  {
    id: 'hydration',
    en: 'Hydration',
    ar: 'الترطيب',
    iconKey: 'droplets',
    badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25',
    iconClass: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'sleep',
    en: 'Sleep',
    ar: 'النوم',
    iconKey: 'moon',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
    iconClass: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'nutrition',
    en: 'Nutrition',
    ar: 'التغذية',
    iconKey: 'apple',
    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25',
    iconClass: 'text-teal-600 dark:text-teal-400',
  },
  {
    id: 'meditation',
    en: 'Meditation',
    ar: 'التأمل',
    iconKey: 'brain',
    badgeClass: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25',
    iconClass: 'text-violet-600 dark:text-violet-400',
  },
  {
    id: 'mindfulness',
    en: 'Mindfulness',
    ar: 'الوعي',
    iconKey: 'sparkles',
    badgeClass: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/25',
    iconClass: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
  {
    id: 'custom',
    en: 'Custom',
    ar: 'مخصص',
    iconKey: 'tag',
    badgeClass: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-400/25',
    iconClass: 'text-slate-500 dark:text-slate-400',
  },
];

export function getHabitCategoryMeta(category?: HabitCategory): HabitCategoryMeta {
  return HABIT_CATEGORIES.find((c) => c.id === category) || HABIT_CATEGORIES[HABIT_CATEGORIES.length - 1];
}

export function filterHabitsByCategory(habits: Habit[], category: HabitCategory | 'all'): Habit[] {
  if (category === 'all') return habits;
  return habits.filter((h) => (h.category || 'custom') === category);
}

export interface HabitPreset {
  id: string;
  category: HabitCategory;
  title: string;
  titleAr: string;
  targetDays: number;
}

export const HABIT_PRESETS: HabitPreset[] = [
  { id: 'preset-health', category: 'health', title: 'Daily Walk (30m)', titleAr: 'مشي يومي (٣٠ دقيقة)', targetDays: 21 },
  { id: 'preset-learning', category: 'learning', title: 'Deep Study Session', titleAr: 'جلسة تعلّم عميق', targetDays: 21 },
  { id: 'preset-productivity', category: 'productivity', title: 'Top 3 Priorities Plan', titleAr: 'تخطيط أولويات اليوم', targetDays: 21 },
  { id: 'preset-hydration', category: 'hydration', title: 'Hydration (2.5L Water)', titleAr: 'شرب الماء (٢.٥ لتر)', targetDays: 7 },
  { id: 'preset-meditation', category: 'meditation', title: 'Meditation / Breathwork (10m)', titleAr: 'تأمل وتنفس عميق (١٠ دقائق)', targetDays: 14 },
];

/**
 * Computes current non-punitive streak ending on `referenceDate` (or yesterday if today isn't logged yet).
 */
export function computeHabitStreak(completedDates: string[], referenceDate: string): number {
  if (!completedDates.length) return 0;
  const set = new Set(completedDates);
  let cursor = set.has(referenceDate) ? referenceDate : addDays(referenceDate, -1);
  if (!set.has(cursor)) return 0;

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (set.has(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * Computes the longest consecutive-day streak across the entire completion history.
 */
export function computeBestHabitStreak(completedDates: string[]): number {
  if (!completedDates.length) return 0;
  const sorted = Array.from(new Set(completedDates)).sort();
  let best = 1;
  let run = 1;

  for (let i = 1; i < sorted.length; i++) {
    if (addDays(sorted[i - 1], 1) === sorted[i]) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

export function getRecentHabitHistory(
  completedDates: string[],
  referenceDate: string,
  days = 7
): Array<{ date: string; done: boolean }> {
  const set = new Set(completedDates);
  return Array.from({ length: days }, (_, idx) => {
    const offset = idx - (days - 1);
    const date = addDays(referenceDate, offset);
    return { date, done: set.has(date) };
  });
}

export function syncHabitStreaks(habit: Habit, referenceDate: string): Habit {
  const deduped = Array.from(new Set(habit.completedDates)).sort();
  const currentStreak = computeHabitStreak(deduped, referenceDate);
  const historicalBest = computeBestHabitStreak(deduped);
  const bestStreak = Math.max(habit.bestStreak ?? 0, historicalBest, currentStreak);
  return {
    ...habit,
    completedDates: deduped,
    currentStreak,
    bestStreak,
  };
}

export function getHabitProgress(habit: Habit, referenceDate: string): {
  doneToday: boolean;
  completedDays: number;
  streak: number;
  bestStreak: number;
  percent: number;
  recentHistory: Array<{ date: string; done: boolean }>;
} {
  const uniqueDates = Array.from(new Set(habit.completedDates));
  const doneToday = uniqueDates.includes(referenceDate);
  const completedDays = uniqueDates.length;
  const streak = computeHabitStreak(uniqueDates, referenceDate);
  const bestStreak = Math.max(habit.bestStreak ?? 0, computeBestHabitStreak(uniqueDates), streak);
  const target = Math.max(1, habit.targetDays);
  const percent = Math.min(100, Math.round((completedDays / target) * 100));
  const recentHistory = getRecentHabitHistory(uniqueDates, referenceDate, 7);
  return { doneToday, completedDays, streak, bestStreak, percent, recentHistory };
}

export function formatTargetDaysLabel(days: number, isAr: boolean): string {
  const safe = Math.max(1, Math.round(days));
  return isAr ? `${safe} يوم` : `${safe} days`;
}

export interface HabitTrendDay {
  date: string;
  day: string;
  completed: number;
  total: number;
  rate: number;
}

export interface HabitTrendsSummary {
  days: HabitTrendDay[];
  totalHabits: number;
  totalCompletions: number;
  possibleCompletions: number;
  averageRate: number;
  topStreak: number;
  bestDay: { date: string; day: string; completed: number } | null;
}

export function getHabitCompletionTrends(
  habits: Habit[],
  referenceDate: string,
  windowDays = 7
): HabitTrendsSummary {
  const safeDays = Math.max(1, Math.round(windowDays));
  const totalHabits = habits.length;
  const habitDateSets = habits.map((h) => new Set(h.completedDates));

  const days: HabitTrendDay[] = Array.from({ length: safeDays }, (_, idx) => {
    const offset = idx - (safeDays - 1);
    const date = addDays(referenceDate, offset);
    let completed = 0;
    for (const set of habitDateSets) {
      if (set.has(date)) completed++;
    }
    const rate = totalHabits > 0 ? Math.round((completed / totalHabits) * 100) : 0;
    return {
      date,
      day: date.slice(5),
      completed,
      total: totalHabits,
      rate,
    };
  });

  const totalCompletions = days.reduce((sum, d) => sum + d.completed, 0);
  const possibleCompletions = totalHabits * safeDays;
  const averageRate =
    possibleCompletions > 0 ? Math.round((totalCompletions / possibleCompletions) * 100) : 0;

  let bestDay: { date: string; day: string; completed: number } | null = null;
  for (const d of days) {
    if (d.completed > 0 && (!bestDay || d.completed >= bestDay.completed)) {
      bestDay = { date: d.date, day: d.day, completed: d.completed };
    }
  }

  const topStreak = habits.reduce(
    (max, h) => Math.max(max, h.currentStreak ?? computeHabitStreak(h.completedDates, referenceDate)),
    0
  );

  return {
    days,
    totalHabits,
    totalCompletions,
    possibleCompletions,
    averageRate,
    topStreak,
    bestDay,
  };
}

export function escapeCsvCell(value: string | number | boolean | undefined | null): string {
  const raw = value === undefined || value === null ? '' : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function buildHabitHistoryCsv(
  habits: Habit[],
  referenceDate: string,
  windowDays = 7
): string {
  const headers = [
    'date',
    'habit_id',
    'habit_title',
    'habit_title_ar',
    'category',
    'completed',
    'current_streak',
    'best_streak',
    'target_days',
    'reminder_time',
    'total_completed_days',
  ];

  if (!habits.length) {
    return headers.join(',');
  }

  const safeDays = Math.max(1, Math.round(windowDays));
  const dateSet = new Set<string>();
  for (let idx = 0; idx < safeDays; idx++) {
    dateSet.add(addDays(referenceDate, idx - (safeDays - 1)));
  }
  for (const h of habits) {
    for (const d of h.completedDates) {
      if (d) dateSet.add(d);
    }
  }
  const sortedDates = Array.from(dateSet).sort();

  const prepared = habits.map((h) => {
    const synced = syncHabitStreaks(h, referenceDate);
    return {
      habit: synced,
      completedSet: new Set(synced.completedDates),
      currentStreak: synced.currentStreak ?? 0,
      bestStreak: synced.bestStreak ?? 0,
      totalCompletedDays: synced.completedDates.length,
    };
  });

  const rows: string[] = [headers.join(',')];
  for (const date of sortedDates) {
    for (const item of prepared) {
      const { habit, completedSet, currentStreak, bestStreak, totalCompletedDays } = item;
      rows.push(
        [
          date,
          habit.id,
          habit.title,
          habit.titleAr,
          habit.category || 'custom',
          completedSet.has(date),
          currentStreak,
          bestStreak,
          habit.targetDays,
          habit.reminderTime || '',
          totalCompletedDays,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }
  }

  return rows.join('\n');
}

export interface HabitInsightEntry {
  habit: Habit;
  recentCount: number;
  previousCount: number;
  delta: number;
  rate: number;
  streak: number;
}

export interface HabitWeeklyInsights {
  windowStart: string;
  windowEnd: string;
  recentTotal: number;
  previousTotal: number;
  overallDelta: number;
  activeHabitsCount: number;
  totalHabits: number;
  mostConsistent: HabitInsightEntry | null;
  mostImproved: HabitInsightEntry | null;
}

export function getHabitWeeklyInsights(
  habits: Habit[],
  referenceDate: string,
  windowDays = 7
): HabitWeeklyInsights {
  const safeDays = Math.max(1, Math.round(windowDays));
  const windowStart = addDays(referenceDate, -(safeDays - 1));
  const recentDates = Array.from({ length: safeDays }, (_, idx) => addDays(windowStart, idx));
  const prevStart = addDays(windowStart, -safeDays);
  const prevDates = Array.from({ length: safeDays }, (_, idx) => addDays(prevStart, idx));

  const entries: HabitInsightEntry[] = habits.map((habit) => {
    const set = new Set(habit.completedDates);
    let recentCount = 0;
    for (const d of recentDates) {
      if (set.has(d)) recentCount++;
    }
    let previousCount = 0;
    for (const d of prevDates) {
      if (set.has(d)) previousCount++;
    }
    const delta = recentCount - previousCount;
    const rate = Math.round((recentCount / safeDays) * 100);
    const streak = Math.max(habit.currentStreak ?? 0, computeHabitStreak(habit.completedDates, referenceDate));
    return { habit, recentCount, previousCount, delta, rate, streak };
  });

  const activeEntries = entries.filter((e) => e.recentCount > 0);
  const mostConsistent =
    activeEntries.length > 0
      ? [...activeEntries].sort((a, b) => {
          if (b.recentCount !== a.recentCount) return b.recentCount - a.recentCount;
          if (b.streak !== a.streak) return b.streak - a.streak;
          return b.habit.completedDates.length - a.habit.completedDates.length;
        })[0]
      : null;

  const improvedEntries = entries.filter((e) => e.delta > 0);
  const mostImproved =
    improvedEntries.length > 0
      ? [...improvedEntries].sort((a, b) => {
          if (b.delta !== a.delta) return b.delta - a.delta;
          if (b.recentCount !== a.recentCount) return b.recentCount - a.recentCount;
          return b.streak - a.streak;
        })[0]
      : null;

  const recentTotal = entries.reduce((sum, e) => sum + e.recentCount, 0);
  const previousTotal = entries.reduce((sum, e) => sum + e.previousCount, 0);

  return {
    windowStart,
    windowEnd: referenceDate,
    recentTotal,
    previousTotal,
    overallDelta: recentTotal - previousTotal,
    activeHabitsCount: activeEntries.length,
    totalHabits: habits.length,
    mostConsistent,
    mostImproved,
  };
}



