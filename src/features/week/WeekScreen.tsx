import React, { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Download, Plus, Sparkles } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { aiClient } from '../../services/aiClient';
import { DayMode } from '../../types/masar';
import { getT } from '../../utils/i18n';
import { generateWeekIcs } from '../../utils/icsExport';
import { addDays, getDayMode, getWeekDates } from '../../utils/planner';

export const WeekScreen: React.FC<{ onSelectDay: (dateStr: string) => void }> = ({ onSelectDay }) => {
  const { state, getTasksForDate, setDayOverride, updateState, pushToast } = useMasar();
  const t = getT(state.language);
  const isAr = state.language === 'ar';

  const [anchorDate, setAnchorDate] = useState(state.activeDate);
  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate]);
  const weekKey = weekDates[0];

  const [ctfTitle, setCtfTitle] = useState('');
  const [ctfDate, setCtfDate] = useState(state.activeDate);
  const [ctfUrl, setCtfUrl] = useState('');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const savedReview = state.weeklyAiReviews?.[weekKey];
  const reviewInsights = Array.isArray(savedReview?.insights) ? savedReview.insights : [];
  const reviewSuggestions = Array.isArray(savedReview?.suggestions) ? savedReview.suggestions : [];
  const ctfEvents = Array.isArray(state.ctfEvents) ? state.ctfEvents : [];

  const weekSummary = useMemo(() => {
    let completed = 0;
    let skipped = 0;
    let plannedMin = 0;
    let actualMin = 0;
    for (const d of weekDates) {
      const list = getTasksForDate(d);
      for (const tk of list) {
        plannedMin += tk.estimatedMinutes;
        actualMin += tk.actualMinutes;
        if (tk.status === 'completed') completed++;
        if (tk.status === 'skipped') skipped++;
      }
    }
    const sleepEntries = weekDates.map((d) => state.sleepLogs?.[d]?.hoursSlept).filter((v): v is number => typeof v === 'number');
    const avgSleep = sleepEntries.length ? Number((sleepEntries.reduce((a, b) => a + b, 0) / sleepEntries.length).toFixed(1)) : null;
    const workoutsDone = (state.workoutLogs ?? []).filter((w) => weekDates.includes(w.date)).length;

    return {
      completed,
      skipped,
      plannedMin,
      actualMin,
      avgSleep,
      workoutsDone,
      focusSessions: (state.focusSessions ?? []).filter((f) => weekDates.includes(f.date)).length,
      quizCount: (state.quizResults ?? []).filter((q) => weekDates.includes(q.date)).length,
    };
  }, [weekDates, getTasksForDate, state.sleepLogs, state.workoutLogs, state.focusSessions, state.quizResults]);

  const handleExportIcs = () => {
    const ics = generateWeekIcs(state, anchorDate);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `masar-week-${weekKey}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(isAr ? 'تم تصدير ملف التقويم .ics بالتنبيهات.' : 'Exported .ics calendar with VALARM reminders.', 'success');
  };

  const handleAddCtf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctfTitle.trim()) return;
    updateState((p) => ({
      ...p,
      ctfEvents: [
        ...p.ctfEvents,
        {
          id: `ctf-${Date.now()}`,
          title: ctfTitle.trim(),
          date: ctfDate,
          url: ctfUrl.trim() || undefined,
          joined: true,
        },
      ],
    }));
    setCtfTitle('');
    setCtfUrl('');
    pushToast(isAr ? 'تمت إضافة حدث CTFtime.' : 'CTFtime event added to Week view.', 'success');
  };

  const handleRunWeeklyAi = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiClient.generateWeeklyReview(weekSummary, state.language);
      const insights = Array.isArray(result?.insights) ? result.insights.map(String) : [];
      const suggestions = Array.isArray(result?.suggestions) ? result.suggestions.map(String) : [];
      if (insights.length === 0 && suggestions.length === 0) {
        throw new Error(t.common.offlineAi);
      }
      updateState((p) => ({
        ...p,
        weeklyAiReviews: {
          ...(p.weeklyAiReviews ?? {}),
          [weekKey]: {
            insights,
            suggestions,
            sleepObservation: typeof result?.sleepObservation === 'string' ? result.sleepObservation : '',
            dataSufficiency: result?.dataSufficiency === 'sufficient' ? 'sufficient' : 'limited',
            generatedAt: new Date().toISOString(),
          },
        },
      }));
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t.common.offlineAi);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Week Switcher */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.week.title}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.week.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchorDate(addDays(anchorDate, -7))}
            aria-label="Previous week"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs tabular-nums px-2">
            {weekDates[0]} → {weekDates[6]}
          </span>
          <button
            type="button"
            onClick={() => setAnchorDate(addDays(anchorDate, 7))}
            aria-label="Next week"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleExportIcs}
            className="min-h-[44px] inline-flex items-center gap-2 px-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium"
          >
            <Download className="w-4 h-4" />
            {t.week.exportIcs}
          </button>
        </div>
      </section>

      {/* Saturday -> Friday Days Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {weekDates.map((d) => {
          const mode = getDayMode(state, d);
          const dayTasks = getTasksForDate(d);
          const screenTasks = dayTasks.filter((tk) => tk.isScreenBased);
          const dayCtfs = ctfEvents.filter((ev) => ev.date === d);
          const isOverridden = !!state.dateOverrides?.[d];
          const [y, m, day] = d.split('-').map(Number);
          const dayName = new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
          }).format(new Date(Date.UTC(y, m - 1, day)));

          return (
            <div
              key={d}
              className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
                d === state.activeDate
                  ? 'bg-cyan-500/[0.06] border-cyan-500/40'
                  : 'bg-white dark:bg-[#0E131E] border-slate-200 dark:border-white/10'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectDay(d)}
                    className="text-start font-semibold text-sm hover:text-cyan-500 transition-colors"
                  >
                    {dayName}
                    <span className="block font-mono text-[11px] font-normal text-slate-500">{d}</span>
                  </button>
                  <select
                    aria-label={`Mode for ${d}`}
                    value={mode}
                    onChange={(e) => setDayOverride(d, e.target.value as DayMode)}
                    className="min-h-[38px] px-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-medium"
                  >
                    <option value="study">{t.week.study}</option>
                    <option value="study_light">{t.week.study_light}</option>
                    <option value="travel_off">{t.week.travel_off}</option>
                    <option value="catch_up">{t.week.catch_up}</option>
                  </select>
                </div>

                {isOverridden && (
                  <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    {isAr ? 'تخصيص يدوي لهذا التاريخ' : 'Per-date override active'}
                  </div>
                )}

                <ul className="mt-3 space-y-1.5 text-xs">
                  {screenTasks.length === 0 ? (
                    <li className="text-slate-500 dark:text-slate-400">
                      {mode === 'travel_off'
                        ? isAr ? 'سفر / إجازة — بودكاست أو قراءة خفيفة فقط' : 'Travel/Off — optional podcast, book, 10m mobility'
                        : isAr ? 'لا توجد مهام متأخرة' : 'Clear catch-up queue'}
                    </li>
                  ) : (
                    screenTasks.map((tk) => (
                      <li key={tk.id} className="space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate ${tk.status === 'completed' ? 'line-through text-slate-400' : ''}`}>
                            {tk.isCatchUp ? '↻ ' : ''}{tk.title}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 shrink-0">{tk.scheduledTime}</span>
                        </div>
                        {tk.plannedItems && tk.plannedItems.length > 0 && (
                          <div className="ps-2 space-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {tk.plannedItems.slice(0, 4).map((pi) => (
                              <div key={pi.itemId} className="truncate">
                                → {pi.itemTitle}
                              </div>
                            ))}
                            {tk.plannedItems.length > 4 && (
                              <div className="text-[10px] text-cyan-600 dark:text-cyan-400">
                                +{tk.plannedItems.length - 4} more
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    ))
                  )}
                  {dayCtfs.map((ev) => (
                    <li key={ev.id} className="text-violet-600 dark:text-violet-400 font-medium truncate">
                      CTF · {ev.title}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onSelectDay(d)}
                className="min-h-[38px] w-full rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5"
              >
                {isAr ? 'فتح في شاشة اليوم' : 'Open in Today'}
              </button>
            </div>
          );
        })}
      </section>

      {/* CTFtime Date-Based Events */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-500" />
          <h2 className="text-base font-semibold">{t.week.ctfEvents}</h2>
        </div>
        <div className="space-y-2">
          {ctfEvents.map((ev) => (
            <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] text-xs">
              <div>
                <span className="font-semibold">{ev.title}</span>
                <span className="mx-2 text-slate-400">·</span>
                <span className="font-mono">{ev.date}</span>
              </div>
              {ev.url && (
                <a href={ev.url} target="_blank" rel="noreferrer" className="text-cyan-600 dark:text-cyan-400 underline">
                  CTFtime
                </a>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={handleAddCtf} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
          <input
            type="text"
            value={ctfTitle}
            onChange={(e) => setCtfTitle(e.target.value)}
            placeholder={isAr ? 'اسم المسابقة' : 'CTF event title'}
            className="sm:col-span-2 min-h-[42px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs"
          />
          <input
            type="date"
            value={ctfDate}
            onChange={(e) => setCtfDate(e.target.value)}
            className="min-h-[42px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono"
          />
          <button
            type="submit"
            className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 text-white text-xs font-medium hover:bg-violet-500"
          >
            <Plus className="w-4 h-4" />
            {t.week.addCtf}
          </button>
        </form>
      </section>

      {/* Thursday Weekly Review & AI Analysis */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t.week.weeklyReview}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? 'تحليل الذكاء الاصطناعي لبيانات الأسبوع الفعلية (٣ ملاحظات + ٣ اقتراحات).'
                : 'AI analyzes your actual completed, skipped, sleep & workout metrics.'}
            </p>
          </div>
          <button
            type="button"
            disabled={aiLoading}
            onClick={handleRunWeeklyAi}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {aiLoading ? (isAr ? 'جارٍ التحليل...' : 'Analyzing...') : t.week.runAiReview}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-3">
            <div className="text-slate-500">{isAr ? 'مهام مكتملة' : 'Completed'}</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums">{weekSummary.completed}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-3">
            <div className="text-slate-500">{isAr ? 'مهام متخطاة' : 'Skipped'}</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums">{weekSummary.skipped}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-3">
            <div className="text-slate-500">{isAr ? 'التمارين' : 'Workouts'}</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums">{weekSummary.workoutsDone}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-3">
            <div className="text-slate-500">{isAr ? 'متوسط النوم' : 'Avg Sleep'}</div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums">{weekSummary.avgSleep ?? '—'}h</div>
          </div>
        </div>

        {aiError && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
            {aiError}
          </div>
        )}

        {savedReview && (reviewInsights.length > 0 || reviewSuggestions.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-white/10 text-xs">
            <div className="space-y-2">
              <h3 className="font-semibold text-cyan-600 dark:text-cyan-400">
                {isAr ? '٣ ملاحظات رئيسية' : '3 Insights'}
              </h3>
              <ul className="space-y-1.5 list-disc list-inside text-slate-700 dark:text-slate-300">
                {reviewInsights.map((ins, i) => (
                  <li key={i}>{ins}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-violet-600 dark:text-violet-400">
                {isAr ? '٣ اقتراحات عملية' : '3 Suggestions'}
              </h3>
              <ul className="space-y-1.5 list-disc list-inside text-slate-700 dark:text-slate-300">
                {reviewSuggestions.map((sug, i) => (
                  <li key={i}>{sug}</li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2 text-slate-600 dark:text-slate-400">
              {savedReview.sleepObservation} · {isAr ? 'كفاية البيانات:' : 'Data sufficiency:'} {savedReview.dataSufficiency}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
