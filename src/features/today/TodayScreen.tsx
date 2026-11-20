import React, { useMemo, useState } from 'react';
import {
  Bell,
  BookOpenCheck,
  Check,
  Clock,
  Coffee,
  FilePlus2,
  FileText,
  Moon,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Sun,
  Timer,
  Utensils,
} from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import {
  ContentCoursePlannerModal,
  sectionTypeIcon,
} from '../../components/ContentCoursePlannerModal';
import { ProgressRing } from '../../components/ProgressRing';
import { DailyTask, DayMode, NavTab, QueueId } from '../../types/masar';
import {
  allocateCourseContentForDate,
  formatMinutesAsEffort,
  getCourseContentProgress,
} from '../../utils/courseContentPlanner';
import { getT } from '../../utils/i18n';
import {
  calculatePacing,
  computeSleepSchedule,
  getCrossFeatureInsights,
  getCurrentCourse,
  getDayMode,
} from '../../utils/planner';
import { CantSleepModal } from '../sleep/CantSleepModal';
import { HabitsSection } from './HabitsSection';
import { QuickNotesSheet } from './QuickNotesSheet';

interface TodayScreenProps {
  onNavigate: (tab: NavTab, librarySub?: string) => void;
  onOpenFocus: (category: QueueId | 'reading' | 'other', topicTitle?: string, topicId?: string) => void;
  onTriggerAlarm: (task: DailyTask) => void;
}

const WIND_DOWN_ITEMS = [
  { key: 'paper_book', en: 'Paper-book reading (15–20m)', ar: 'قراءة كتاب ورقي (١٥–٢٠ دقيقة)' },
  { key: 'speaking', en: 'English speaking challenge', ar: 'تحدي التحدث بالإنجليزية' },
  { key: 'hooponopono', en: 'Hooponopono gratitude', ar: 'تمرين هوبونوبونو' },
  { key: 'bedtime_prep', en: 'Room cool & phone away', ar: 'تجهيز الغرفة وإبعاد الهاتف' },
  { key: 'reflection', en: '1-line evening reflection', ar: 'تأمل مسائي من سطر واحد' },
];

function localizeTaskTitle(title: string, isAr: boolean): string {
  if (!isAr) return title;
  if (title.startsWith('Workout ')) return title.replace('Workout ', 'التمرين ');
  if (title.startsWith('Read: ')) return title.replace('Read: ', 'قراءة: ').replace(' pages)', ' صفحة)');
  if (title.startsWith('Podcast: ')) return title.replace('Podcast: ', 'بودكاست: ');
  if (title === '10-Minute Travel Mobility') return 'مرونة وحركة لمدة ١٠ دقائق';
  return title;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  onNavigate,
  onOpenFocus,
  onTriggerAlarm,
}) => {
  const {
    state,
    getTasksForDate,
    updateTaskStatus,
    setDayOverride,
    toggleHabitDate,
    toggleCourseItemCompleted,
    updateState,
    setActiveDate,
  } = useMasar();

  const t = getT(state.language);
  const isAr = state.language === 'ar';
  const dateStr = state.activeDate;
  const tasks = getTasksForDate(dateStr);
  const dayMode = getDayMode(state, dateStr);
  const sleep = computeSleepSchedule(state.sleepSettings);
  const ntiPacing = calculatePacing(state, 'nti', dateStr);
  const alerts = useMemo(() => getCrossFeatureInsights(state, dateStr), [state, dateStr]);

  const [noteTask, setNoteTask] = useState<DailyTask | null>(null);
  const [cantSleepOpen, setCantSleepOpen] = useState(false);
  const [contentPlannerOpen, setContentPlannerOpen] = useState(false);
  const [contentPlannerQueue, setContentPlannerQueue] = useState<QueueId>('extra');

  const completedCount = tasks.filter((tk) => tk.status === 'completed').length;
  const activeTotal = tasks.filter((tk) => tk.status !== 'skipped').length || 1;
  const completionPct = Math.round((completedCount / activeTotal) * 100);

  const whatNowTask = tasks.find((tk) => tk.status === 'in_progress' || tk.status === 'pending');
  const whatNextTask = tasks.find((tk) => tk.id !== whatNowTask?.id && tk.status === 'pending');

  const ntiCurrent = getCurrentCourse(state.courses, 'nti');
  const extraCurrent = getCurrentCourse(state.courses, 'extra');
  const activityCurrent = getCurrentCourse(state.courses, 'activity');
  const languageCurrent = getCurrentCourse(state.courses, 'language');
  const currentBook = state.books.find((b) => b.status === 'current');
  const nextPodcast = state.podcasts.find((p) => !p.completed);
  const nextSpeaking = state.speakingDays.find((d) => !d.completed);

  const sleepLog = state.sleepLogs[dateStr] || {
    date: dateStr,
    plannedBedtime: sleep.bedtime,
    sunlightDone: false,
  };

  const formattedDate = useMemo(() => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat(isAr ? 'ar-EG' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  }, [dateStr, isAr]);

  const renderTaskCard = (task: DailyTask, queueBadge: string) => {
    const isDone = task.status === 'completed';
    const isSkipped = task.status === 'skipped';
    const isReview = task.status === 'review_later';

    return (
      <div
        key={task.id}
        data-testid={`task-card-${task.category}`}
        className={`rounded-2xl border p-4 transition-colors ${
          isDone
            ? 'bg-emerald-500/[0.06] border-emerald-500/25'
            : isSkipped
              ? 'bg-slate-100/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 opacity-60'
              : 'bg-white dark:bg-[#0E131E] border-slate-200 dark:border-white/10'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-cyan-600 dark:text-cyan-400">{queueBadge}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{task.scheduledTime}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">~{task.estimatedMinutes}{t.common.minutes}</span>
              {task.isCatchUp && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {isAr ? 'تعويض' : 'Catch-up'}
                  </span>
                </>
              )}
              {isReview && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-violet-600 dark:text-violet-400 font-medium">
                    {isAr ? 'مراجعة +٢ يوم' : 'Review +2d'}
                  </span>
                </>
              )}
            </div>
            <h3 className={`mt-1 text-base font-semibold ${isDone ? 'line-through text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
              {task.title}
            </h3>
            {task.subtitle && (
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{task.subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => updateTaskStatus(dateStr, task.id, isDone ? 'pending' : 'completed')}
            aria-label={`${isDone ? 'Undo' : 'Complete'} ${task.title}`}
            className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center border transition-colors shrink-0 ${
              isDone
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-slate-300 dark:border-white/15 text-slate-500 hover:border-cyan-500 hover:text-cyan-500'
            }`}
          >
            <Check className="w-5 h-5" />
          </button>
        </div>

        {/* Content-Based Course Sections Breakdown (additive for content-planned courses) */}
        {(() => {
          const linkedCourse = task.courseId
            ? state.courses.find((c) => c.id === task.courseId)
            : undefined;
          if (!linkedCourse?.isContentPlanned || task.isCatchUp) return null;

          const allocation = allocateCourseContentForDate(state, linkedCourse, dateStr);
          const contentProg = getCourseContentProgress(linkedCourse, state, dateStr);

          // Group display items by Chapter while preserving order
          const chapters: Array<{ topicId: string; topicTitle: string; items: typeof allocation.allDisplayItems }> = [];
          for (const entry of allocation.allDisplayItems) {
            let grp = chapters.find((g) => g.topicId === entry.topicId);
            if (!grp) {
              grp = { topicId: entry.topicId, topicTitle: entry.topicTitle, items: [] };
              chapters.push(grp);
            }
            grp.items.push(entry);
          }

          if (chapters.length === 0 && !contentProg.isCompleted) return null;

          return (
            <div
              data-testid={`content-plan-block-${linkedCourse.queue}`}
              className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 space-y-2.5"
            >
              {chapters.map((ch) => (
                <div key={ch.topicId} className="space-y-1">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {ch.topicTitle}
                  </div>
                  <div className="space-y-1 ps-1">
                    {ch.items.map((item) => (
                      <button
                        key={item.itemId}
                        type="button"
                        data-testid={`today-section-item-${item.itemId}`}
                        onClick={() => toggleCourseItemCompleted(linkedCourse.id, item.topicId, item.itemId)}
                        className={`w-full min-h-[34px] px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-xs text-start transition-colors ${
                          item.completed
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-50 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold shrink-0">
                            {item.completed ? '✓' : '→'}
                          </span>
                          {sectionTypeIcon(item.sectionType)}
                          <span className={`truncate ${item.completed ? 'line-through opacity-80' : ''}`}>
                            {item.itemTitle}
                          </span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0">
                          ~{item.estimatedMinutes}m
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                <span>
                  {isAr ? 'الجهد المقدر اليوم:' : 'Estimated effort:'}{' '}
                  <strong className="font-mono text-slate-700 dark:text-slate-200">
                    {formatMinutesAsEffort(allocation.totalEstimatedMinutes, isAr)}
                  </strong>
                </span>
                <span data-testid={`course-content-progress-${linkedCourse.queue}`} className="font-mono tabular-nums">
                  {contentProg.completedSections}/{contentProg.totalSections}{' '}
                  {isAr ? 'أقسام' : 'Sections'} ({contentProg.percent}%) ·{' '}
                  {isAr ? 'المتبقي:' : 'Est. Remaining:'} {contentProg.estimatedRemainingHours}h ·{' '}
                  {contentProg.deadline ? `${isAr ? 'الموعد:' : 'Deadline:'} ${contentProg.deadline} · ` : ''}
                  <span
                    className={
                      contentProg.status === 'behind'
                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                        : contentProg.status === 'ahead'
                          ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                          : 'text-cyan-600 dark:text-cyan-400 font-semibold'
                    }
                  >
                    {t.pacing[contentProg.status]}
                  </span>
                </span>
              </div>
            </div>
          );
        })()}

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center gap-1.5">
          {!isDone && (
            <>
              <button
                type="button"
                onClick={() => {
                  updateTaskStatus(dateStr, task.id, 'in_progress');
                  const cat = (['nti', 'extra', 'activity', 'language', 'reading'].includes(task.category)
                    ? task.category
                    : 'other') as QueueId | 'reading' | 'other';
                  onOpenFocus(cat, task.title, task.topicId);
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                {t.today.start}
              </button>
              <button
                type="button"
                onClick={() => updateTaskStatus(dateStr, task.id, 'skipped')}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap"
              >
                <SkipForward className="w-3.5 h-3.5" />
                {t.today.skip}
              </button>
              <button
                type="button"
                onClick={() => updateTaskStatus(dateStr, task.id, 'snoozed')}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap"
              >
                <Clock className="w-3.5 h-3.5" />
                {t.today.snooze}
              </button>
              {task.topicId && (
                <button
                  type="button"
                  onClick={() => updateTaskStatus(dateStr, task.id, 'review_later')}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t.today.reviewLater}
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => setNoteTask(task)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" />
            {t.common.notes}
          </button>
          {!isDone && (
            <button
              type="button"
              onClick={() => onTriggerAlarm(task)}
              aria-label={`Alarm for ${task.title}`}
              className="min-h-[40px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Bell className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const ntiTasks = tasks.filter((tk) => tk.category === 'nti' || tk.category === 'review');
  const extraTasks = tasks.filter((tk) => tk.category === 'extra');
  const activityTasks = tasks.filter((tk) => tk.category === 'activity');
  const languageTasks = tasks.filter((tk) => tk.category === 'language');
  const workoutTask = tasks.find((tk) => tk.category === 'workout');
  const postureTask = tasks.find((tk) => tk.category === 'posture');

  const dayWindDown = state.windDownChecklist[dateStr] || {};

  return (
    <div className="space-y-5">
      {/* 1. MISSION CARD */}
      <section
        aria-label={t.today.missionTitle}
        className="rounded-3xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{formattedDate}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-cyan-600 dark:text-cyan-400">
                {t.week[dayMode]}
              </span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-medium ${
                  ntiPacing.status === 'behind'
                    ? 'text-amber-600 dark:text-amber-400'
                    : ntiPacing.status === 'ahead'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-cyan-600 dark:text-cyan-400'
                }`}
              >
                {t.pacing[ntiPacing.status]}
              </span>
            </div>
            <h1 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
              {ntiCurrent ? (
                <>
                  <span>{ntiCurrent.title}</span>{' '}
                  <span className="text-slate-500 dark:text-slate-400 font-semibold text-base sm:text-xl inline-block">
                    {ntiCurrent.platform || 'S006'}
                  </span>
                </>
              ) : (
                t.today.missionTitle
              )}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {isAr
                ? 'الموضوع أولاً: أتمّ موضوعاً واضحاً قبل وقت إغلاق الشاشات.'
                : 'Topic completion first — protect sleep while advancing your current track.'}
            </p>
          </div>
          <ProgressRing percent={completionPct} size={60} strokeWidth={5} />
        </div>

        {/* Immediate Answer Strip: What Now / What Next / Override */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
          <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">{t.today.whatNow}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {whatNowTask ? localizeTaskTitle(whatNowTask.title, isAr) : isAr ? 'أتممت مهام اليوم!' : 'All planned blocks complete'}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">{t.today.whatNext}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {whatNextTask ? localizeTaskTitle(whatNextTask.title, isAr) : isAr ? 'روتين ما قبل النوم' : 'Screenless Wind-Down'}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] p-3 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{isAr ? 'وضع اليوم' : 'Day Override'}</div>
              <div className="mt-0.5 text-xs font-mono text-slate-600 dark:text-slate-300">{dateStr}</div>
            </div>
            <select
              aria-label="Override day mode"
              value={dayMode}
              onChange={(e) => setDayOverride(dateStr, e.target.value as DayMode)}
              className="min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs font-medium"
            >
              <option value="study">{t.week.study}</option>
              <option value="study_light">{t.week.study_light}</option>
              <option value="catch_up">{t.week.catch_up}</option>
              <option value="travel_off">{t.week.travel_off}</option>
            </select>
          </div>
        </div>

        {/* Date quick switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <label htmlFor="active-date-picker" className="text-slate-500 dark:text-slate-400">
              {isAr ? 'التاريخ النشط:' : 'Active date:'}
            </label>
            <input
              id="active-date-picker"
              type="date"
              value={dateStr}
              onChange={(e) => e.target.value && setActiveDate(e.target.value)}
              className="min-h-[38px] px-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-xs"
            />
          </div>
          <button
            type="button"
            onClick={() => onOpenFocus('nti', whatNowTask?.title, whatNowTask?.topicId)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded-xl bg-violet-600/15 text-violet-700 dark:text-violet-300 border border-violet-500/30 font-medium hover:bg-violet-600/25 transition-colors"
          >
            <Timer className="w-4 h-4" />
            {t.today.focusTimer}
          </button>
        </div>
      </section>

      {/* Cross-Feature Intelligence Alerts */}
      {alerts.length > 0 && (
        <section aria-label="Adaptive insights" className="space-y-2">
          {alerts.map((al) => (
            <div
              key={al.id}
              className={`rounded-2xl px-4 py-3 text-xs sm:text-sm border flex items-center gap-2.5 ${
                al.severity === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-200'
                  : 'bg-cyan-500/10 border-cyan-500/25 text-cyan-800 dark:text-cyan-200'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{isAr ? al.messageAr : al.message}</span>
            </div>
          ))}
        </section>
      )}

      {/* 2. SLEEP GUARD */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-violet-500" />
            <h2 className="text-base font-semibold">{t.today.sleepGuard}</h2>
          </div>
          <button
            type="button"
            onClick={() => setCantSleepOpen(true)}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            {t.today.cantSleep}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-2.5">
            <div className="text-slate-500">{t.today.wakeTime}</div>
            <div className="mt-0.5 font-mono font-semibold tabular-nums">{sleep.wakeTime}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-2.5">
            <div className="text-slate-500">{t.today.targetSleep}</div>
            <div className="mt-0.5 font-mono font-semibold tabular-nums">{sleep.targetSleepHours}h</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-2.5">
            <div className="text-slate-500">{t.today.bedtime}</div>
            <div className="mt-0.5 font-mono font-semibold tabular-nums text-violet-600 dark:text-violet-400">{sleep.bedtime}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-2.5">
            <div className="text-slate-500">{t.today.screensOff}</div>
            <div className="mt-0.5 font-mono font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">{sleep.screensOff}</div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-2.5 flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div>
              <div className="text-slate-500">{t.today.lastMeal}</div>
              <div className="font-mono font-semibold tabular-nums">{sleep.lastMeal}</div>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-2.5 flex items-center gap-1.5">
            <Coffee className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <div>
              <div className="text-slate-500">{t.today.lastCoffee}</div>
              <div className="font-mono font-semibold tabular-nums">{sleep.lastCoffee}</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
          <button
            type="button"
            onClick={() => {
              updateState((p) => ({
                ...p,
                sleepLogs: {
                  ...p.sleepLogs,
                  [dateStr]: { ...sleepLog, sunlightDone: !sleepLog.sunlightDone },
                },
              }));
              toggleHabitDate('h-sun', dateStr);
            }}
            className={`min-h-[40px] inline-flex items-center gap-2 px-3 rounded-xl border transition-colors ${
              sleepLog.sunlightDone
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Sun className="w-4 h-4" />
            {t.today.sunlight} ({sleep.morningSunlight} · 10–15m)
          </button>

          <label className="inline-flex items-center gap-2">
            <span className="text-slate-500">{isAr ? 'ساعات النوم الفعلية:' : 'Logged sleep (h):'}</span>
            <input
              type="number"
              min={3}
              max={12}
              step={0.5}
              value={sleepLog.hoursSlept ?? ''}
              placeholder="7"
              onChange={(e) => {
                const hrs = Number(e.target.value);
                updateState((p) => ({
                  ...p,
                  sleepLogs: {
                    ...p.sleepLogs,
                    [dateStr]: { ...sleepLog, hoursSlept: isNaN(hrs) ? undefined : hrs },
                  },
                }));
              }}
              className="w-16 min-h-[38px] px-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-xs tabular-nums"
            />
          </label>
        </div>
      </section>

      {/* 3. WORKOUT & COMMUTE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {workoutTask && (
          <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">{t.today.workout}</div>
                <h2 className="text-base font-semibold mt-0.5">{workoutTask.title}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{workoutTask.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => updateTaskStatus(dateStr, workoutTask.id, workoutTask.status === 'completed' ? 'pending' : 'completed')}
                aria-label="Toggle workout complete"
                className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center border ${
                  workoutTask.status === 'completed'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'border-slate-300 dark:border-white/15'
                }`}
              >
                <Check className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate('library', 'workout')}
                className="min-h-[40px] px-3.5 rounded-xl bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-500"
              >
                {isAr ? 'فتح التمرين والعداد' : 'Open Workout Sets & Timer'}
              </button>
              <button
                type="button"
                onClick={() => updateTaskStatus(dateStr, workoutTask.id, 'skipped')}
                className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium"
              >
                {t.today.skip}
              </button>
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-2.5">
          <div className="text-xs text-violet-600 dark:text-violet-400 font-medium">{t.today.commute}</div>
          <h2 className="text-base font-semibold">
            {currentBook ? currentBook.title : nextPodcast?.title || (isAr ? 'المكتبة جاهزة' : 'Queue Ready')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {currentBook
              ? `${currentBook.currentPage}/${currentBook.totalPages} ${t.common.pages} · ${isAr ? 'هدف اليوم:' : 'Daily target:'} ${currentBook.dailyTargetPages}`
              : nextPodcast
                ? `${nextPodcast.progressMinutes}/${nextPodcast.durationMinutes} min`
                : ''}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('library', 'reading')}
            className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5"
          >
            {isAr ? 'تسجيل الصفحات / الاستماع' : 'Log Pages / Open Reader'}
          </button>
        </section>
      </div>

      {/* 4. NTI / EXTRA / ACTIVITY / LANGUAGE QUEUE BLOCKS */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span>{t.today.ntiBlock} · {ntiCurrent?.title}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>{ntiPacing.topicsRemaining} {t.pacing.topicsLeft}</span>
          </div>
          <button
            type="button"
            data-testid="today-plan-from-content-btn"
            onClick={() => {
              setContentPlannerQueue('extra');
              setContentPlannerOpen(true);
            }}
            className="min-h-[34px] inline-flex items-center gap-1.5 px-3 rounded-xl border border-cyan-500/35 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-xs font-medium hover:bg-cyan-500/20"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            {isAr ? 'تخطيط دورة من المحتوى' : 'Plan Course from Content'}
          </button>
        </div>

        {/* Completed Content-Planned Course Prompt -> "What do you want to study next?" */}
        {(() => {
          const completedContentCourses = state.courses.filter(
            (c) =>
              c.isContentPlanned &&
              c.status === 'completed' &&
              !state.courses.some((other) => other.queue === c.queue && other.status === 'current' && other.isContentPlanned)
          );
          if (completedContentCourses.length === 0) return null;
          return completedContentCourses.map((doneCourse) => (
            <div
              key={doneCourse.id}
              data-testid={`today-course-complete-${doneCourse.id}`}
              className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  <BookOpenCheck className="w-4 h-4" />
                  <span>100% COMPLETE · {doneCourse.title}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {isAr ? 'ماذا تريد أن تدرس بعد ذلك؟' : 'What do you want to study next?'}
                </p>
              </div>
              <button
                type="button"
                data-testid="today-next-course-content-btn"
                onClick={() => {
                  setContentPlannerQueue(doneCourse.queue);
                  setContentPlannerOpen(true);
                }}
                className="min-h-[42px] inline-flex items-center gap-1.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                <FilePlus2 className="w-4 h-4" />
                {isAr ? 'لصق محتوى الدورة التالية' : 'Paste Next Course Content'}
              </button>
            </div>
          ));
        })()}

        <div className="space-y-2.5">
          {ntiTasks.length > 0 ? (
            ntiTasks.map((tk) => renderTaskCard(tk, 'NTI'))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 p-4 text-sm text-slate-500">
              {dayMode === 'travel_off'
                ? isAr ? 'يوم سفر/إجازة — لا مهام دراسة أساسية مجدولة.' : 'Travel / Off day — no normal study workload scheduled.'
                : isAr ? 'لا توجد مهام NTI مجدولة في نافذة النوم المتاحة.' : 'No NTI tasks scheduled in remaining window.'}
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>{t.today.extraBlock} · {extraCurrent?.title}</span>
          </div>
          {extraTasks.map((tk) => renderTaskCard(tk, 'EXTRA'))}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>{t.today.activityBlock} · {activityCurrent?.title}</span>
          </div>
          {activityTasks.map((tk) => renderTaskCard(tk, 'ACTIVITY'))}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>{t.today.languageBlock}</span>
          </div>
          {languageTasks.length > 0 ? (
            languageTasks.map((tk) => renderTaskCard(tk, 'LANGUAGE'))
          ) : !languageCurrent ? (
            <div className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{isAr ? 'لا توجد دورة إنجليزية بعد' : 'No English course yet'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr ? 'أضف دورتك الخاصة بنفس بنية المسارات.' : 'Add your English course using Queue → Course → Topic.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('library', 'courses')}
                className="min-h-[44px] px-4 rounded-xl bg-cyan-600 text-white text-xs font-medium whitespace-nowrap"
              >
                {isAr ? 'إضافة دورة إنجليزية' : 'Add English Course'}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* 5. HABITS */}
      <HabitsSection />

      {/* 6. SPEAKING CHALLENGE & 7. SCREENLESS WIND-DOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {nextSpeaking && (
          <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-2.5">
            <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">
              {t.today.speaking} · Day {nextSpeaking.day}/30
            </div>
            <h2 className="text-base font-semibold">
              {isAr ? nextSpeaking.topicAr : nextSpeaking.topic}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">{nextSpeaking.instructions}</p>
            <button
              type="button"
              onClick={() => onNavigate('library', 'speaking')}
              className="min-h-[40px] px-4 rounded-xl bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-500"
            >
              {isAr ? 'فتح المؤقت والمسجل الصوتي' : 'Open Speaking Timer & Recorder'}
            </button>
          </section>
        )}

        <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs text-violet-600 dark:text-violet-400 font-medium">{t.today.windDown}</div>
              <h2 className="text-base font-semibold">
                {isAr ? `بعد ${sleep.screensOff} (بدون شاشات)` : `After ${sleep.screensOff} (Screenless)`}
              </h2>
            </div>
            {postureTask && (
              <button
                type="button"
                onClick={() => onNavigate('library', 'workout')}
                className="min-h-[38px] px-3 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium"
              >
                {t.today.eveningPosture}
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {WIND_DOWN_ITEMS.map((item) => {
              const checked = !!dayWindDown[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    updateState((p) => ({
                      ...p,
                      windDownChecklist: {
                        ...p.windDownChecklist,
                        [dateStr]: { ...(p.windDownChecklist[dateStr] || {}), [item.key]: !checked },
                      },
                    }))
                  }
                  className="w-full min-h-[40px] flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] text-xs font-medium text-start"
                >
                  <span className={checked ? 'line-through text-slate-400' : ''}>{isAr ? item.ar : item.en}</span>
                  <span
                    className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                      checked ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-300 dark:border-white/20'
                    }`}
                  >
                    {checked && <Check className="w-3.5 h-3.5" />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <QuickNotesSheet task={noteTask} onClose={() => setNoteTask(null)} />
      <CantSleepModal open={cantSleepOpen} onClose={() => setCantSleepOpen(false)} />
      <ContentCoursePlannerModal
        open={contentPlannerOpen}
        onClose={() => setContentPlannerOpen(false)}
        defaultQueue={contentPlannerQueue}
      />
    </div>
  );
};
