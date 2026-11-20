import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Compass,
  GitBranch,
  Search,
  Settings,
  WifiOff,
} from 'lucide-react';
import { MasarProvider, useMasar } from './app/MasarContext';
import { AlarmOverlay } from './components/AlarmOverlay';
import { BottomSheet } from './components/BottomSheet';
import { ContentCoursePlannerModal } from './components/ContentCoursePlannerModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FocusTimerModal } from './components/FocusTimerModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { MasarLogo } from './components/MasarLogo';
import { OnboardingFlow } from './components/OnboardingFlow';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SettingsSheet } from './components/SettingsSheet';
import { LibraryScreen, LibrarySubTab } from './features/library/LibraryScreen';
import { QuizModal } from './features/library/QuizModal';
import { RoadmapScreen } from './features/roadmap/RoadmapScreen';
import { StatsScreen } from './features/stats/StatsScreen';
import { TodayScreen } from './features/today/TodayScreen';
import { WeekScreen } from './features/week/WeekScreen';
import { useOnlineStatus } from './pwa/useOnlineStatus';
import { DailyTask, NavTab, QueueId } from './types/masar';
import { getT } from './utils/i18n';
import {
  formatTimeHHMM,
  getDueHabitReminders,
  getDueTaskReminders,
  isInQuietHours,
} from './utils/notifications';

const MasarShell: React.FC = () => {
  const {
    state,
    isHydrated,
    toasts,
    pushToast,
    setLanguage,
    setActiveDate,
    updateTaskStatus,
    promptNextCourseId,
    dismissNextCoursePrompt,
    promoteNextCourse,
  } = useMasar();

  const t = getT(state.language);
  const isAr = state.language === 'ar';
  const isOnline = useOnlineStatus();

  const [activeTab, setActiveTab] = useState<NavTab>('today');
  const [librarySub, setLibrarySub] = useState<LibrarySubTab>('courses');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusConfig, setFocusConfig] = useState<{
    open: boolean;
    category: QueueId | 'reading' | 'other';
    topicTitle?: string;
    topicId?: string;
  }>({ open: false, category: 'nti' });
  const [alarmTask, setAlarmTask] = useState<DailyTask | null>(null);
  const [nextCoursePlannerQueue, setNextCoursePlannerQueue] = useState<QueueId | null>(null);
  const sentNotificationKeysRef = useRef<Set<string>>(new Set());

  // Scheduled notification check every 15s (deduplicated per minute) when alerts are enabled
  useEffect(() => {
    if (!state.notificationPrefs.enabled) {
      return;
    }

    const checkDueNotifications = () => {
      const hhmm = formatTimeHHMM(new Date());
      if (isInQuietHours(hhmm, state.notificationPrefs.quietHoursStart, state.notificationPrefs.quietHoursEnd)) {
        return;
      }

      const canUseWebNotification =
        typeof Notification !== 'undefined' && Notification.permission === 'granted';

      if (state.notificationPrefs.taskReminders) {
        const todayTasks = state.tasksByDate[state.activeDate] || [];
        const dueTasks = getDueTaskReminders(todayTasks, state.activeDate, hhmm, sentNotificationKeysRef.current);
        for (const tk of dueTasks) {
          sentNotificationKeysRef.current.add(`task:${tk.id}:${state.activeDate}:${hhmm}`);
          if (canUseWebNotification) {
            new Notification(`${tk.category.toUpperCase()} — Masar OS`, {
              body: `Start your current topic: ${tk.title}`,
              icon: './pwa-192x192.png',
              tag: `task-${tk.id}-${state.activeDate}`,
            });
          }
          pushToast(
            isAr ? `تذكير مهمة: ${tk.title}` : `Task reminder: ${tk.title}`,
            'info'
          );
        }
      }

      const dueHabits = getDueHabitReminders(
        state.habits,
        state.activeDate,
        hhmm,
        sentNotificationKeysRef.current
      );
      for (const h of dueHabits) {
        sentNotificationKeysRef.current.add(`habit:${h.id}:${state.activeDate}:${hhmm}`);
        const habitName = isAr ? h.titleAr || h.title : h.title;
        if (canUseWebNotification) {
          new Notification(isAr ? 'تذكير عادة — مَسَار OS' : 'Habit Reminder — Masar OS', {
            body: isAr ? `حان وقت: ${habitName}` : `Time for your habit: ${habitName}`,
            icon: './pwa-192x192.png',
            tag: `habit-${h.id}-${state.activeDate}`,
          });
        }
        pushToast(
          isAr ? `تذكير العادة: ${habitName}` : `Habit reminder: ${habitName}`,
          'info'
        );
      }
    };

    checkDueNotifications();
    const id = window.setInterval(checkDueNotifications, 15000);
    return () => window.clearInterval(id);
  }, [state.notificationPrefs, state.tasksByDate, state.habits, state.activeDate, isAr, pushToast]);

  if (!isHydrated) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#07090F] text-slate-200 gap-3">
        <MasarLogo size={48} />
        <div className="text-sm font-medium tracking-wide">Masar OS</div>
      </div>
    );
  }

  if (!state.onboardingCompleted) {
    return <OnboardingFlow />;
  }

  const handleNavigate = (tab: NavTab, sub?: string) => {
    setActiveTab(tab);
    if (tab === 'library' && sub) {
      setLibrarySub(sub as LibrarySubTab);
    }
  };

  const navItems: Array<{ id: NavTab; label: string; icon: React.ReactNode }> = [
    { id: 'today', label: t.nav.today, icon: <Compass className="w-5 h-5" /> },
    { id: 'week', label: t.nav.week, icon: <CalendarDays className="w-5 h-5" /> },
    { id: 'roadmap', label: t.nav.roadmap, icon: <GitBranch className="w-5 h-5" /> },
    { id: 'library', label: t.nav.library, icon: <BookOpen className="w-5 h-5" /> },
    { id: 'stats', label: t.nav.stats, icon: <BarChart3 className="w-5 h-5" /> },
  ];

  const completedCourseObj = promptNextCourseId
    ? state.courses.find((c) => c.id === promptNextCourseId)
    : null;

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 dark:bg-[#07090F] text-slate-900 dark:text-slate-100">
      {/* Compact Sticky Header (<= 48px mobile) */}
      <header className="sticky top-0 z-30 h-12 sm:h-14 pt-safe bg-white/90 dark:bg-[#07090F]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10">
        <div className="max-w-6xl mx-auto h-full px-3 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('today')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            <MasarLogo size={28} />
            <span className="font-display font-bold text-base tracking-tight">
              {t.appName}
            </span>
          </button>

          {/* Zone 2: Desktop Primary Nav */}
          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-5">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[40px] text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                  activeTab === item.id
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Header Utility Actions (Search, Language, Settings) */}
          <div className="flex items-center gap-1 shrink-0">
            <div className="hidden sm:block">
              <PWAInstallButton language={state.language} />
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={t.nav.search}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLanguage(state.language === 'en' ? 'ar' : 'en')}
              aria-label="Switch language"
              className="min-h-[44px] px-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap"
            >
              {state.language === 'en' ? 'AR' : 'EN'}
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={t.nav.settings}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 pb-20 md:pb-8">
        <ErrorBoundary>
          {activeTab === 'today' && (
            <TodayScreen
              onNavigate={handleNavigate}
              onOpenFocus={(category, topicTitle, topicId) =>
                setFocusConfig({ open: true, category, topicTitle, topicId })
              }
              onTriggerAlarm={(task) => setAlarmTask(task)}
            />
          )}
          {activeTab === 'week' && (
            <WeekScreen
              onSelectDay={(d) => {
                setActiveDate(d);
                setActiveTab('today');
              }}
            />
          )}
          {activeTab === 'roadmap' && <RoadmapScreen />}
          {activeTab === 'library' && (
            <LibraryScreen subTab={librarySub} onChangeSubTab={setLibrarySub} />
          )}
          {activeTab === 'stats' && <StatsScreen />}
        </ErrorBoundary>
      </main>

      {/* Mobile Bottom Navigation Bar (56px, <=15% combined with header) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 pb-safe bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-t border-slate-200 dark:border-white/10 grid grid-cols-5 items-center"
      >
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active
                  ? 'text-cyan-600 dark:text-cyan-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed bottom-16 md:bottom-4 start-4 z-40 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-medium shadow-lg">
          <WifiOff className="w-3.5 h-3.5" />
          {isAr ? 'وضع عدم الاتصال — البيانات المحلية نشطة' : 'Offline Mode — Local data active'}
        </div>
      )}

      {/* Toasts */}
      <div className="fixed top-16 end-3 z-50 space-y-2 pointer-events-none max-w-xs">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`px-3.5 py-2.5 rounded-xl text-xs font-medium shadow-lg border backdrop-blur-md ${
              toast.tone === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
                : toast.tone === 'warning'
                  ? 'bg-amber-950/90 border-amber-500/40 text-amber-100'
                  : 'bg-slate-900/90 border-white/15 text-slate-100'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>

      {/* Modals & Sheets */}
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <GlobalSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleNavigate}
      />
      <FocusTimerModal
        open={focusConfig.open}
        onClose={() => setFocusConfig((c) => ({ ...c, open: false }))}
        defaultCategory={focusConfig.category}
        defaultTopicTitle={focusConfig.topicTitle}
        defaultTopicId={focusConfig.topicId}
      />
      <AlarmOverlay
        task={alarmTask}
        onStart={() => {
          if (!alarmTask) return;
          updateTaskStatus(alarmTask.date, alarmTask.id, 'in_progress');
          setFocusConfig({
            open: true,
            category: (['nti', 'extra', 'activity', 'language', 'reading'].includes(alarmTask.category)
              ? alarmTask.category
              : 'other') as QueueId | 'reading' | 'other',
            topicTitle: alarmTask.title,
            topicId: alarmTask.topicId,
          });
          setAlarmTask(null);
        }}
        onSnooze={() => {
          if (alarmTask) updateTaskStatus(alarmTask.date, alarmTask.id, 'snoozed');
          setAlarmTask(null);
        }}
        onSkip={() => {
          if (alarmTask) updateTaskStatus(alarmTask.date, alarmTask.id, 'skipped');
          setAlarmTask(null);
        }}
        onDismiss={() => setAlarmTask(null)}
      />
      <QuizModal />

      {/* Course Completed -> 100% COMPLETE + "What do you want to study next?" */}
      <BottomSheet
        open={!!completedCourseObj}
        onClose={dismissNextCoursePrompt}
        title={
          completedCourseObj?.isContentPlanned
            ? isAr ? '١٠٠٪ مكتمل!' : '100% COMPLETE'
            : isAr ? 'اكتملت الدورة!' : 'Course Completed!'
        }
      >
        {completedCourseObj && (
          <div data-testid="course-completed-sheet" className="space-y-4 text-sm">
            {completedCourseObj.isContentPlanned ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  100% COMPLETE
                </div>
                <p className="font-semibold text-base">
                  {isAr ? 'ماذا تريد أن تدرس بعد ذلك؟' : 'What do you want to study next?'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr
                    ? `أتممت جميع محتويات "${completedCourseObj.title}". الصق محتوى الدورة التالية لتحديد الموعد النهائي ووقت الدراسة.`
                    : `You finished all sections in "${completedCourseObj.title}". Paste the next course outline to set its deadline and study schedule.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="completion-paste-next-course-btn"
                    onClick={() => {
                      const q = completedCourseObj.queue;
                      dismissNextCoursePrompt();
                      setNextCoursePlannerQueue(q);
                    }}
                    className="flex-1 min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                  >
                    {isAr ? 'لصق محتوى الدورة التالية' : 'Paste Next Course Content'}
                  </button>
                  <button
                    type="button"
                    onClick={dismissNextCoursePrompt}
                    className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-white/10"
                  >
                    {isAr ? 'لاحقاً' : 'Later'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  {isAr
                    ? `أتممت جميع مواضيع "${completedCourseObj.title}". هل تريد الانتقال للدورة التالية أم إضافة دورة جديدة من المحتوى؟`
                    : `You completed all topics in "${completedCourseObj.title}". What do you want to study next?`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => promoteNextCourse(completedCourseObj.id)}
                    className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 text-white font-medium"
                  >
                    {isAr ? 'نعم، انتقل للتالية' : 'Move to Next Course'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const q = completedCourseObj.queue;
                      dismissNextCoursePrompt();
                      setNextCoursePlannerQueue(q);
                    }}
                    className="min-h-[44px] px-4 rounded-xl border border-cyan-500/40 text-cyan-600 dark:text-cyan-300 font-medium"
                  >
                    {isAr ? 'لصق دورة جديدة' : 'Paste New Course'}
                  </button>
                  <button
                    type="button"
                    onClick={dismissNextCoursePrompt}
                    className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-white/10"
                  >
                    {isAr ? 'لاحقاً' : 'Stay Here'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </BottomSheet>

      <ContentCoursePlannerModal
        open={!!nextCoursePlannerQueue}
        onClose={() => setNextCoursePlannerQueue(null)}
        defaultQueue={nextCoursePlannerQueue || 'extra'}
      />
    </div>
  );
};

export default function App() {
  return (
    <MasarProvider>
      <MasarShell />
    </MasarProvider>
  );
}
