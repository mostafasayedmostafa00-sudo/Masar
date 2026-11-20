import React, { useState } from 'react';
import { ArrowRight, Bell, Check, ChevronLeft } from 'lucide-react';
import { useMasar } from '../app/MasarContext';
import { DayMode, Language, ThemeMode } from '../types/masar';
import { computeSleepSchedule } from '../utils/planner';
import { MasarLogo } from './MasarLogo';

const DAY_LABELS = [
  { dow: 6, en: 'Sat', ar: 'السبت' },
  { dow: 0, en: 'Sun', ar: 'الأحد' },
  { dow: 1, en: 'Mon', ar: 'الإثنين' },
  { dow: 2, en: 'Tue', ar: 'الثلاثاء' },
  { dow: 3, en: 'Wed', ar: 'الأربعاء' },
  { dow: 4, en: 'Thu', ar: 'الخميس' },
  { dow: 5, en: 'Fri', ar: 'الجمعة' },
];

export const OnboardingFlow: React.FC = () => {
  const { state, setLanguage, setTheme, updateState, pushToast } = useMasar();
  const [step, setStep] = useState(0);
  const isAr = state.language === 'ar';

  const sleep = computeSleepSchedule(state.sleepSettings);
  const ntiCourses = state.courses.filter((c) => c.queue === 'nti');
  const extraCourses = state.courses.filter((c) => c.queue === 'extra');
  const activityCourses = state.courses.filter((c) => c.queue === 'activity');
  const currentNti = ntiCourses.find((c) => c.status === 'current')?.id || ntiCourses[0]?.id;
  const currentExtra = extraCourses.find((c) => c.status === 'current')?.id || extraCourses[0]?.id;
  const currentAct = activityCourses.find((c) => c.status === 'current')?.id || activityCourses[0]?.id;
  const currentBook = state.books.find((b) => b.status === 'current')?.id || state.books[0]?.id;

  const setQueueCurrent = (queue: 'nti' | 'extra' | 'activity', courseId: string) => {
    updateState((prev) => ({
      ...prev,
      courses: prev.courses.map((c) => {
        if (c.queue !== queue) return c;
        return { ...c, status: c.id === courseId ? 'current' : 'upcoming' };
      }),
    }));
  };

  const setFirstBook = (bookId: string) => {
    updateState((prev) => ({
      ...prev,
      books: prev.books.map((b) => ({
        ...b,
        status: b.id === bookId ? 'current' : 'upcoming',
      })),
    }));
  };

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      pushToast(isAr ? 'الإشعارات غير مدعومة في هذا المتصفح.' : 'Notifications not supported in this browser.', 'warning');
      return;
    }
    const perm = await Notification.requestPermission();
    updateState((prev) => ({
      ...prev,
      notificationPrefs: { ...prev.notificationPrefs, enabled: perm === 'granted' },
    }));
  };

  const finishOnboarding = () => {
    updateState((prev) => ({ ...prev, onboardingCompleted: true }));
  };

  return (
    <div className="min-h-dvh flex flex-col justify-between bg-slate-50 dark:bg-[#07090F] text-slate-900 dark:text-slate-100 px-4 py-6 sm:py-10">
      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <MasarLogo size={36} />
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                {isAr ? 'مرحباً بك في مَسَار OS' : 'Welcome to Masar OS'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? `الخطوة ${step + 1} من ٤` : `Step ${step + 1} of 4`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={finishOnboarding}
            className="min-h-[44px] px-3 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            {isAr ? 'تخطي' : 'Skip setup'}
          </button>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-5 sm:p-6 space-y-5">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">{isAr ? 'اللغة والمظهر' : 'Language & Appearance'}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {isAr
                    ? 'اختر لغة الواجهة ومظهر نظام القيادة الشخصي.'
                    : 'Choose interface direction and visual theme.'}
                </p>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  {isAr ? 'اللغة' : 'Language'}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['en', 'ar'] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setLanguage(lang)}
                      className={`min-h-[44px] rounded-xl border text-sm font-medium transition-colors ${
                        state.language === lang
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                          : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {lang === 'en' ? 'English (LTR)' : 'العربية (RTL)'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  {isAr ? 'المظهر' : 'Theme'}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['dark', 'light', 'system'] as ThemeMode[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`min-h-[44px] rounded-xl border text-sm font-medium capitalize transition-colors ${
                        state.theme === t
                          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                          : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">{isAr ? 'حارس النوم والروتين الأسبوعي' : 'Sleep Guard & Study Days'}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {isAr ? 'تنتهي جميع المهام الدراسية تلقائياً قبل إغلاق الشاشات.' : 'Screen study blocks automatically end before screens-off.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{isAr ? 'وقت الاستيقاظ' : 'Wake time'}</span>
                  <input
                    type="time"
                    value={state.sleepSettings.wakeTime}
                    onChange={(e) =>
                      updateState((p) => ({ ...p, sleepSettings: { ...p.sleepSettings, wakeTime: e.target.value } }))
                    }
                    className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{isAr ? 'ساعات النوم (٦–٩)' : 'Target sleep (6–9h)'}</span>
                  <input
                    type="number"
                    min={6}
                    max={9}
                    step={0.5}
                    value={state.sleepSettings.targetSleepHours}
                    onChange={(e) =>
                      updateState((p) => ({
                        ...p,
                        sleepSettings: { ...p.sleepSettings, targetSleepHours: Number(e.target.value) || 7 },
                      }))
                    }
                    className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono tabular-nums"
                  />
                </label>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                {isAr ? 'النوم:' : 'Bedtime:'} {sleep.bedtime} · {isAr ? 'إغلاق الشاشات:' : 'Screens off:'} {sleep.screensOff}
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  {isAr ? 'أيام الأسبوع (السبت ← الجمعة)' : 'Weekly Routine (Sat → Fri)'}
                </div>
                <div className="space-y-2">
                  {DAY_LABELS.map((d) => (
                    <div key={d.dow} className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{isAr ? d.ar : d.en}</span>
                      <select
                        value={state.weeklyTemplate[d.dow]}
                        onChange={(e) =>
                          updateState((p) => ({
                            ...p,
                            weeklyTemplate: { ...p.weeklyTemplate, [d.dow]: e.target.value as DayMode },
                          }))
                        }
                        className="min-h-[40px] px-2.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs"
                      >
                        <option value="study">{isAr ? 'دراسة' : 'Study'}</option>
                        <option value="study_light">{isAr ? 'دراسة خفيفة' : 'Study — Light'}</option>
                        <option value="catch_up">{isAr ? 'تعويض ومراجعة' : 'Catch-up'}</option>
                        <option value="travel_off">{isAr ? 'سفر / إجازة' : 'Travel / Off'}</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold">{isAr ? 'مسارات الانطلاق الحالية' : 'Current Active Tracks'}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {isAr ? 'عنصر واحد حالي في كل مسار لمنع التشتت.' : 'One current focus per queue to prevent overwhelm.'}
                </p>
              </div>
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">NTI Course</span>
                <select
                  value={currentNti}
                  onChange={(e) => setQueueCurrent('nti', e.target.value)}
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm"
                >
                  {ntiCourses.map((c) => (
                    <option key={c.id} value={c.id}>{c.order}. {c.title}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">Extra Course</span>
                <select
                  value={currentExtra}
                  onChange={(e) => setQueueCurrent('extra', e.target.value)}
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm"
                >
                  {extraCourses.map((c) => (
                    <option key={c.id} value={c.id}>{c.order}. {c.title}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">Activity Platform</span>
                <select
                  value={currentAct}
                  onChange={(e) => setQueueCurrent('activity', e.target.value)}
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm"
                >
                  {activityCourses.map((c) => (
                    <option key={c.id} value={c.id}>{c.order}. {c.title}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">{isAr ? 'الكتاب الحالي' : 'First Book'}</span>
                <select
                  value={currentBook}
                  onChange={(e) => setFirstBook(e.target.value)}
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm"
                >
                  {state.books.map((b) => (
                    <option key={b.id} value={b.id}>{b.order}. {b.title}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold">{isAr ? 'الإشعارات والجاهزية' : 'Reminders & Launch'}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {isAr
                    ? 'فعّل إشعارات المتصفح للتذكير بوقت بدء الموضوع وإغلاق الشاشات.'
                    : 'Enable browser reminders for topic start cues, sunlight, and screens-off.'}
                </p>
              </div>
              <button
                type="button"
                onClick={requestNotifications}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-sm font-medium hover:bg-cyan-500/20 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {state.notificationPrefs.enabled
                  ? isAr ? 'الإشعارات مفعلة' : 'Notifications Enabled'
                  : isAr ? 'السماح بالإشعارات' : 'Enable Notification Permission'}
              </button>
              <div className="rounded-xl bg-slate-100 dark:bg-white/5 p-3.5 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <div>{isAr ? 'تذكير: الجمعة ٢٠ نوفمبر ٢٠٢٦ مضبوط على دراسة خفيفة.' : 'Note: Friday 20 Nov 2026 starts overridden to Study — Light.'}</div>
                <div>{isAr ? 'يمكنك تعديل كل الإعدادات لاحقاً من الرأس.' : 'All preferences remain editable in Settings at any time.'}</div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="min-h-[44px] inline-flex items-center gap-1.5 px-3 text-sm font-medium text-slate-600 dark:text-slate-400 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              {isAr ? 'السابق' : 'Back'}
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
              >
                {isAr ? 'التالي' : 'Continue'}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={finishOnboarding}
                className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
              >
                <Check className="w-4 h-4" />
                {isAr ? 'دخول مركز القيادة' : 'Enter Mission Control'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
