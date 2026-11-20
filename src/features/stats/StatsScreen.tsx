import React, { useMemo } from 'react';
import { Award, Download, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMasar } from '../../app/MasarContext';
import {
  buildHabitHistoryCsv,
  getHabitCategoryMeta,
  getHabitCompletionTrends,
  getHabitWeeklyInsights,
} from '../../utils/habits';
import { getT } from '../../utils/i18n';
import { calculatePacing, getWeekDates } from '../../utils/planner';

export const StatsScreen: React.FC = () => {
  const { state, getTasksForDate, pushToast } = useMasar();
  const t = getT(state.language);
  const isAr = state.language === 'ar';

  const stats = useMemo(() => {
    const allTopics = state.courses.flatMap((c) => c.topics);
    const topicsStudied = allTopics.filter((tp) => tp.studied).length;
    const topicsRecalled = allTopics.filter((tp) => tp.recalled).length;
    const recallRate = topicsStudied > 0 ? Math.round((topicsRecalled / topicsStudied) * 100) : 0;

    const allTasks = Object.keys(state.tasksByDate).flatMap((d) => state.tasksByDate[d]);
    const todayTasks = getTasksForDate(state.activeDate);
    const combinedTasks = allTasks.length > 0 ? allTasks : todayTasks;
    const completedTasks = combinedTasks.filter((tk) => tk.status === 'completed').length;
    const completionRate = combinedTasks.length > 0 ? Math.round((completedTasks / combinedTasks.length) * 100) : 0;

    const plannedMin = combinedTasks.reduce((a, b) => a + b.estimatedMinutes, 0);
    const actualFocusMin = state.focusSessions.reduce((a, b) => a + b.actualMinutes, 0);
    const actualTaskMin = combinedTasks.reduce((a, b) => a + b.actualMinutes, 0);
    const actualMin = Math.max(actualFocusMin, actualTaskMin);

    const quizAvg = state.quizResults.length
      ? Math.round(
          (state.quizResults.reduce((a, q) => a + q.score / Math.max(1, q.total), 0) / state.quizResults.length) * 100
        )
      : 0;

    const sleepEntries = Object.values(state.sleepLogs).filter((s) => typeof s.hoursSlept === 'number');
    const sleepAdherence = sleepEntries.length
      ? Math.round(
          (sleepEntries.filter((s) => (s.hoursSlept || 0) >= state.sleepSettings.targetSleepHours - 0.5).length /
            sleepEntries.length) *
            100
        )
      : 0;

    const habitTicks = state.habits.reduce((a, h) => a + h.completedDates.length, 0);
    const totalPagesRead = state.books.reduce((a, b) => a + b.currentPage, 0);

    const ntiPacing = calculatePacing(state, 'nti', state.activeDate);
    const extraPacing = calculatePacing(state, 'extra', state.activeDate);
    const delayedCourses = [
      ntiPacing.status === 'behind' ? 'NTI' : null,
      extraPacing.status === 'behind' ? 'Extra' : null,
    ].filter(Boolean);

    // Best study hour from focus sessions
    const hourBuckets: Record<number, number> = {};
    for (const fs of state.focusSessions) {
      const hr = new Date(fs.startedAt).getHours();
      hourBuckets[hr] = (hourBuckets[hr] || 0) + fs.actualMinutes;
    }
    const bestHourEntry = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
    const bestHour = bestHourEntry ? `${String(bestHourEntry[0]).padStart(2, '0')}:00` : state.sleepSettings.eveningStartTime;

    const weekDates = getWeekDates(state.activeDate);
    const chartData = weekDates.map((d) => {
      const dTasks = getTasksForDate(d);
      const pMin = dTasks.filter((x) => x.isScreenBased).reduce((a, b) => a + b.estimatedMinutes, 0);
      const aMin = dTasks.filter((x) => x.status === 'completed').reduce((a, b) => a + (b.actualMinutes || b.estimatedMinutes), 0);
      return {
        day: d.slice(5),
        planned: pMin,
        actual: aMin,
      };
    });

    const habitChart = state.habits.map((h) => ({
      name: (isAr ? h.titleAr : h.title).slice(0, 10),
      days: h.completedDates.length,
    }));

    const habit7dTrends = getHabitCompletionTrends(state.habits, state.activeDate, 7);
    const weeklyInsights = getHabitWeeklyInsights(state.habits, state.activeDate, 7);

    return {
      topicsStudied,
      totalTopics: allTopics.length,
      recallRate,
      completionRate,
      plannedMin,
      actualMin,
      quizAvg,
      sleepAdherence,
      habitTicks,
      workoutCount: state.workoutLogs.length,
      totalPagesRead,
      delayedCourses,
      bestHour,
      chartData,
      habitChart,
      habit7dTrends,
      weeklyInsights,
    };
  }, [state, getTasksForDate, isAr]);

  const metricCards = [
    { label: t.stats.topicsCompleted, value: `${stats.topicsStudied}/${stats.totalTopics}` },
    { label: t.pacing.completionRate, value: `${stats.completionRate}%` },
    { label: t.stats.recallRate, value: `${stats.recallRate}%` },
    { label: t.stats.quizPerf, value: `${stats.quizAvg}%` },
    { label: t.stats.sleepAdherence, value: `${stats.sleepAdherence}%` },
    { label: t.stats.workoutVolume, value: `${stats.workoutCount}` },
    { label: t.stats.readingProgress, value: `${stats.totalPagesRead} p` },
    { label: isAr ? 'أفضل ساعة دراسة' : 'Best Study Hour', value: stats.bestHour },
  ];

  const handleExportHabitsCsv = () => {
    const csv = buildHabitHistoryCsv(state.habits, state.activeDate, 7);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `masar-habits-history-${state.activeDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(
      isAr ? 'تم تصدير سجل العادات بصيغة CSV.' : 'Habit history CSV exported.',
      'success'
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metricCards.map((m) => (
          <div
            key={m.label}
            className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-3.5"
          >
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.label}</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Planned vs Actual Minutes Chart */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.stats.plannedVsActual}</h2>
          <span className="font-mono text-xs tabular-nums text-slate-500">
            {stats.actualMin} / {stats.plannedMin} min · {t.stats.delayedCourses}:{' '}
            {stats.delayedCourses.length ? stats.delayedCourses.join(', ') : isAr ? 'لا يوجد' : 'None'}
          </span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0E131E',
                  borderColor: 'rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="planned" fill="#334155" radius={[6, 6, 0, 0]} name={isAr ? 'مخطط' : 'Planned'} />
              <Bar dataKey="actual" fill="#06B6D4" radius={[6, 6, 0, 0]} name={isAr ? 'فعلي' : 'Actual'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 7-Day Habit Completion Trends Summary */}
      <section
        data-testid="habit-7d-summary"
        aria-label={isAr ? 'ملخص اتجاه إتمام العادات لآخر ٧ أيام' : '7-Day Habit Completion Trends'}
        className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">
              {isAr ? 'اتجاه إتمام العادات (آخر ٧ أيام)' : 'Habit Completion Trends (Last 7 Days)'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? 'ملخص الالتزام اليومي من سجل العادات المحفوظ'
                : 'Daily completion count across your tracked habits'}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {stats.habit7dTrends.days[0]?.day} → {stats.habit7dTrends.days[stats.habit7dTrends.days.length - 1]?.day}
            </span>
            <button
              type="button"
              data-testid="export-habits-csv"
              onClick={handleExportHabitsCsv}
              disabled={state.habits.length === 0}
              aria-label={isAr ? 'تصدير سجل العادات CSV' : 'Export habit history CSV'}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              {isAr ? 'تصدير CSV' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {isAr ? 'إنجازات ٧ أيام' : '7-Day Completions'}
            </div>
            <div
              data-testid="habit-7d-completions"
              className="mt-1 font-mono text-base sm:text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400"
            >
              {stats.habit7dTrends.totalCompletions}/{stats.habit7dTrends.possibleCompletions}
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {isAr ? 'متوسط الالتزام' : '7-Day Adherence'}
            </div>
            <div
              data-testid="habit-7d-rate"
              className="mt-1 font-mono text-base sm:text-lg font-bold tabular-nums text-slate-900 dark:text-white"
            >
              {stats.habit7dTrends.averageRate}%
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 p-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {isAr ? 'أفضل يوم / سلسلة' : 'Peak Day / Streak'}
            </div>
            <div
              data-testid="habit-7d-peak"
              className="mt-1 font-mono text-base sm:text-lg font-bold tabular-nums text-cyan-600 dark:text-cyan-400"
            >
              {stats.habit7dTrends.bestDay
                ? `${stats.habit7dTrends.bestDay.day} (${stats.habit7dTrends.bestDay.completed})`
                : `${stats.habit7dTrends.topStreak}d`}
            </div>
          </div>
        </div>

        {stats.habit7dTrends.totalHabits === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/15 p-5 text-center text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'لا توجد عادات مسجلة بعد. أضف عاداتك من شاشة اليوم لعرض الاتجاه الأسبوعي.'
              : 'No habits tracked yet. Define daily habits on the Today screen to view 7-day trends.'}
          </div>
        ) : (
          <div data-testid="habit-7d-chart" className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.habit7dTrends.days}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis
                  allowDecimals={false}
                  domain={[0, Math.max(stats.habit7dTrends.totalHabits, 1)]}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0E131E',
                    borderColor: 'rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  formatter={(value, _name, item) => {
                    const payload = item?.payload as { total?: number; rate?: number } | undefined;
                    const count = value ?? 0;
                    const total = payload?.total ?? stats.habit7dTrends.totalHabits;
                    const rate = payload?.rate ?? 0;
                    return [
                      isAr ? `${count}/${total} (${rate}%)` : `${count}/${total} habits (${rate}%)`,
                      isAr ? 'مكتمل' : 'Completed',
                    ];
                  }}
                />
                <Bar
                  dataKey="completed"
                  fill="#10B981"
                  radius={[6, 6, 0, 0]}
                  name={isAr ? 'العادات المكتملة' : 'Habits completed'}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Habit Consistency Chart */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{t.stats.habitConsistency}</h2>
          <span className="font-mono text-xs tabular-nums text-slate-500">
            {stats.habitTicks} {isAr ? 'إجمالي الإنجاز' : 'total ticks'}
          </span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.habitChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0E131E',
                  borderColor: 'rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="days" fill="#8B5CF6" radius={[6, 6, 0, 0]} name={isAr ? 'أيام مكتملة' : 'Days completed'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Weekly Insights Textual Report */}
      <section
        data-testid="weekly-insights-section"
        aria-label={isAr ? 'تقرير رؤى الأسبوع للعادات' : 'Weekly Insights Report'}
        className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">
              {isAr ? 'رؤى الأسبوع' : 'Weekly Insights'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? 'تقرير نصي لأداء العادات خلال آخر ٧ أيام مقارنة بالأسبوع السابق'
                : 'Narrative summary of your habit momentum over the last 7 days'}
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {stats.weeklyInsights.windowStart.slice(5)} → {stats.weeklyInsights.windowEnd.slice(5)}
          </span>
        </div>

        <p
          data-testid="weekly-insights-summary"
          className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 px-3.5 py-3"
        >
          {stats.weeklyInsights.totalHabits === 0 ? (
            isAr
              ? 'لا توجد عادات مسجلة بعد. أضف عاداتك اليومية في شاشة اليوم لتوليد تقرير رؤى الأسبوع.'
              : 'No daily habits are defined yet. Add habits on the Today screen to generate your Weekly Insights report.'
          ) : stats.weeklyInsights.recentTotal === 0 ? (
            isAr
              ? `لم يتم تسجيل إتمام أي عادة خلال الفترة ${stats.weeklyInsights.windowStart.slice(5)} إلى ${stats.weeklyInsights.windowEnd.slice(5)}. أكمل عادة واحدة اليوم لبدء تتبع التحسن والاستمرارية.`
              : `No habit completions were logged from ${stats.weeklyInsights.windowStart.slice(5)} to ${stats.weeklyInsights.windowEnd.slice(5)}. Complete a habit today to start building your weekly insights.`
          ) : isAr ? (
            `خلال آخر ٧ أيام (${stats.weeklyInsights.windowStart.slice(5)} إلى ${stats.weeklyInsights.windowEnd.slice(5)})، سجلت ${stats.weeklyInsights.recentTotal} إتماماً عبر ${stats.weeklyInsights.activeHabitsCount} من أصل ${stats.weeklyInsights.totalHabits} عادات (${
              stats.weeklyInsights.overallDelta > 0
                ? `+${stats.weeklyInsights.overallDelta} مقارنة بالأسبوع السابق`
                : stats.weeklyInsights.overallDelta < 0
                  ? `${stats.weeklyInsights.overallDelta} مقارنة بالأسبوع السابق`
                  : 'مماثل للأسبوع السابق'
            }).`
          ) : (
            `Over the last 7 days (${stats.weeklyInsights.windowStart.slice(5)} to ${stats.weeklyInsights.windowEnd.slice(5)}), you logged ${stats.weeklyInsights.recentTotal} completion${stats.weeklyInsights.recentTotal === 1 ? '' : 's'} across ${stats.weeklyInsights.activeHabitsCount} of ${stats.weeklyInsights.totalHabits} tracked habits (${
              stats.weeklyInsights.overallDelta > 0
                ? `+${stats.weeklyInsights.overallDelta} vs the prior 7 days`
                : stats.weeklyInsights.overallDelta < 0
                  ? `${stats.weeklyInsights.overallDelta} vs the prior 7 days`
                  : 'even with the prior 7 days'
            }).`
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Most Improved Habit */}
          <div
            data-testid="insight-most-improved"
            className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5 space-y-1.5"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <TrendingUp className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{isAr ? 'العادة الأكثر تحسناً' : 'Most Improved Habit'}</span>
            </div>
            {stats.weeklyInsights.mostImproved ? (
              <>
                <div className="text-sm font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                  <span>
                    {isAr
                      ? stats.weeklyInsights.mostImproved.habit.titleAr || stats.weeklyInsights.mostImproved.habit.title
                      : stats.weeklyInsights.mostImproved.habit.title}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    ({isAr
                      ? getHabitCategoryMeta(stats.weeklyInsights.mostImproved.habit.category).ar
                      : getHabitCategoryMeta(stats.weeklyInsights.mostImproved.habit.category).en})
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {isAr
                    ? `ارتفع الإنجاز من ${stats.weeklyInsights.mostImproved.previousCount}/٧ إلى ${stats.weeklyInsights.mostImproved.recentCount}/٧ أيام (+${stats.weeklyInsights.mostImproved.delta} مقارنة بالـ ٧ أيام السابقة).`
                    : `Improved from ${stats.weeklyInsights.mostImproved.previousCount}/7 to ${stats.weeklyInsights.mostImproved.recentCount}/7 days (+${stats.weeklyInsights.mostImproved.delta} vs the prior 7 days).`}
                </p>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'أكمل أي عادة بعدد أيام أكبر من الأسبوع السابق لإبراز العادة الأكثر تحسناً.'
                  : 'Complete any habit more days than in the previous 7-day window to highlight your biggest gain.'}
              </p>
            )}
          </div>

          {/* Most Consistent Habit */}
          <div
            data-testid="insight-most-consistent"
            className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-3.5 space-y-1.5"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
              <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{isAr ? 'العادة الأكثر استمرارية' : 'Most Consistent Habit'}</span>
            </div>
            {stats.weeklyInsights.mostConsistent ? (
              <>
                <div className="text-sm font-semibold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                  <span>
                    {isAr
                      ? stats.weeklyInsights.mostConsistent.habit.titleAr || stats.weeklyInsights.mostConsistent.habit.title
                      : stats.weeklyInsights.mostConsistent.habit.title}
                  </span>
                  <span className="text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                    ({isAr
                      ? getHabitCategoryMeta(stats.weeklyInsights.mostConsistent.habit.category).ar
                      : getHabitCategoryMeta(stats.weeklyInsights.mostConsistent.habit.category).en})
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {isAr
                    ? `أنجزت هذه العادة في ${stats.weeklyInsights.mostConsistent.recentCount} من آخر ٧ أيام (${stats.weeklyInsights.mostConsistent.rate}%، وسلسلة حالية ${stats.weeklyInsights.mostConsistent.streak} يوم).`
                    : `Completed ${stats.weeklyInsights.mostConsistent.recentCount} of the last 7 days (${stats.weeklyInsights.mostConsistent.rate}% adherence, ${stats.weeklyInsights.mostConsistent.streak}d active streak).`}
                </p>
              </>
            ) : (
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'سجّل إتمام أي عادة خلال آخر ٧ أيام لتحديد العادة الأكثر انتظاماً.'
                  : 'Log habit completions over the last 7 days to identify your most consistent habit.'}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
