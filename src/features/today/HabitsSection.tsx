import React, { useState } from 'react';
import {
  Apple,
  Bell,
  BookOpen,
  Brain,
  Check,
  Droplets,
  Dumbbell,
  Flame,
  HeartPulse,
  Moon,
  Pencil,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  Zap,
} from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { BottomSheet } from '../../components/BottomSheet';
import { ProgressRing } from '../../components/ProgressRing';
import { Habit, HabitCategory } from '../../types/masar';
import {
  HABIT_CATEGORIES,
  HABIT_PRESETS,
  HabitIconKey,
  filterHabitsByCategory,
  getHabitCategoryMeta,
  getHabitProgress,
} from '../../utils/habits';
import { getT } from '../../utils/i18n';

function renderHabitCategoryIcon(iconKey: HabitIconKey, className = 'w-3.5 h-3.5 shrink-0') {
  switch (iconKey) {
    case 'heart':
      return <HeartPulse className={className} aria-hidden="true" />;
    case 'book':
      return <BookOpen className={className} aria-hidden="true" />;
    case 'zap':
      return <Zap className={className} aria-hidden="true" />;
    case 'dumbbell':
      return <Dumbbell className={className} aria-hidden="true" />;
    case 'droplets':
      return <Droplets className={className} aria-hidden="true" />;
    case 'moon':
      return <Moon className={className} aria-hidden="true" />;
    case 'apple':
      return <Apple className={className} aria-hidden="true" />;
    case 'brain':
      return <Brain className={className} aria-hidden="true" />;
    case 'sparkles':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'tag':
    default:
      return <Tag className={className} aria-hidden="true" />;
  }
}

export const HabitsSection: React.FC = () => {
  const { state, toggleHabitDate, addHabit, updateHabit, deleteHabit, updateState, pushToast } = useMasar();
  const t = getT(state.language);
  const isAr = state.language === 'ar';
  const dateStr = state.activeDate;

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<HabitCategory | 'all'>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [category, setCategory] = useState<HabitCategory>('health');
  const [targetDays, setTargetDays] = useState('21');
  const [reminderTime, setReminderTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const completedTodayCount = state.habits.filter((h) => h.completedDates.includes(dateStr)).length;
  const hasRemindersConfigured = state.habits.some((h) => !!h.reminderTime);
  const availableCategories = HABIT_CATEGORIES.filter((cat) =>
    state.habits.some((h) => (h.category || 'custom') === cat.id)
  );
  const effectiveFilter =
    activeCategoryFilter !== 'all' && availableCategories.every((c) => c.id !== activeCategoryFilter)
      ? 'all'
      : activeCategoryFilter;
  const displayedHabits = filterHabitsByCategory(state.habits, effectiveFilter);

  const handleEnableHabitAlerts = async () => {
    if (typeof Notification === 'undefined') {
      updateState((p) => ({
        ...p,
        notificationPrefs: { ...p.notificationPrefs, enabled: true },
      }));
      pushToast(isAr ? 'تم تفعيل تنبيهات العادات داخل التطبيق.' : 'In-app habit alerts enabled.', 'success');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      updateState((p) => ({
        ...p,
        notificationPrefs: { ...p.notificationPrefs, enabled: true },
      }));
      pushToast(
        perm === 'granted'
          ? isAr ? 'تم تفعيل إشعارات العادات.' : 'Habit notifications enabled.'
          : isAr ? 'تم تفعيل تنبيهات العادات داخل التطبيق.' : 'In-app habit alerts enabled (browser notifications not granted).',
        perm === 'granted' ? 'success' : 'info'
      );
    } catch {
      updateState((p) => ({
        ...p,
        notificationPrefs: { ...p.notificationPrefs, enabled: true },
      }));
    }
  };

  const openCreateModal = () => {
    setEditingHabit(null);
    setTitle('');
    setTitleAr('');
    setCategory('health');
    setTargetDays('21');
    setReminderTime('');
    setFormError(null);
    setSheetOpen(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setTitle(habit.title);
    setTitleAr(habit.titleAr);
    setCategory(habit.category || 'custom');
    setTargetDays(String(habit.targetDays));
    setReminderTime(habit.reminderTime || '');
    setFormError(null);
    setSheetOpen(true);
  };

  const applyPreset = (presetId: string) => {
    const preset = HABIT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setTitle(preset.title);
    setTitleAr(preset.titleAr);
    setCategory(preset.category);
    setTargetDays(String(preset.targetDays));
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError(isAr ? 'يرجى إدخال اسم العادة.' : 'Please enter a habit name.');
      return;
    }
    const parsedDays = Math.max(1, Math.min(365, Number(targetDays) || 21));

    if (editingHabit) {
      updateHabit(editingHabit.id, {
        title: cleanTitle,
        titleAr: (titleAr || cleanTitle).trim(),
        category,
        targetDays: parsedDays,
        targetDaysLabel: `${parsedDays} days`,
        reminderTime: reminderTime.trim() || undefined,
      });
    } else {
      addHabit({
        title: cleanTitle,
        titleAr: (titleAr || cleanTitle).trim(),
        category,
        targetDays: parsedDays,
        reminderTime: reminderTime.trim() || undefined,
      });
    }
    setSheetOpen(false);
  };

  return (
    <section
      aria-label={t.today.habits}
      className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-semibold">{t.today.habits}</h2>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {completedTodayCount}/{state.habits.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasRemindersConfigured && !state.notificationPrefs.enabled && (
            <button
              type="button"
              onClick={handleEnableHabitAlerts}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              <Bell className="w-3.5 h-3.5 text-cyan-500" />
              {isAr ? 'تفعيل التنبيهات' : 'Enable Alerts'}
            </button>
          )}
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAr ? 'عادة جديدة' : 'New Habit'}
          </button>
        </div>
      </div>

      {state.habits.length > 0 && availableCategories.length > 0 && (
        <div
          role="group"
          aria-label={isAr ? 'تصفية العادات حسب الفئة' : 'Filter habits by category'}
          className="flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            data-testid="habit-filter-all"
            onClick={() => setActiveCategoryFilter('all')}
            aria-pressed={effectiveFilter === 'all'}
            className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
              effectiveFilter === 'all'
                ? 'border-cyan-500 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            {isAr ? `الكل (${state.habits.length})` : `All (${state.habits.length})`}
          </button>
          {availableCategories.map((cat) => {
            const active = effectiveFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                data-testid={`habit-filter-${cat.id}`}
                onClick={() => setActiveCategoryFilter(cat.id)}
                aria-pressed={active}
                className={`min-h-[32px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  active
                    ? 'border-cyan-500 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {renderHabitCategoryIcon(cat.iconKey, `w-3.5 h-3.5 shrink-0 ${cat.iconClass}`)}
                <span>{isAr ? cat.ar : cat.en}</span>
              </button>
            );
          })}
        </div>
      )}

      {state.habits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/15 p-6 text-center space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'لا توجد عادات يومية بعد. أضف عادة مثل التمرين أو شرب الماء أو التأمل.'
              : 'No daily habits defined yet. Add habits like exercise, hydration, or meditation.'}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-4 rounded-xl bg-cyan-600 text-white text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            {isAr ? 'إضافة أول عادة' : 'Add Your First Habit'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {displayedHabits.map((h) => {
            const { doneToday, completedDays, streak, bestStreak, percent, recentHistory } = getHabitProgress(
              h,
              dateStr
            );
            const displayStreak = h.currentStreak ?? streak;
            const displayBest = Math.max(h.bestStreak ?? 0, bestStreak);
            const displayTitle = isAr ? h.titleAr || h.title : h.title;
            const catMeta = getHabitCategoryMeta(h.category);
            const catLabel = isAr ? catMeta.ar : catMeta.en;

            return (
              <div
                key={h.id}
                data-testid={`habit-row-${h.id}`}
                className={`rounded-xl border px-3 py-2.5 space-y-2 transition-colors ${
                  doneToday
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none py-0.5">
                    <span className="relative flex items-center justify-center shrink-0">
                      <input
                        type="checkbox"
                        checked={doneToday}
                        onChange={() => toggleHabitDate(h.id, dateStr)}
                        aria-label={`Mark ${displayTitle} complete for ${dateStr}`}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500 ${
                          doneToday
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white dark:bg-[#07090F] border-slate-300 dark:border-white/25 text-transparent hover:border-cyan-500'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </span>
                    </span>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div
                        className={`text-sm font-medium truncate ${
                          doneToday ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {displayTitle}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                        <span
                          data-testid={`habit-category-${h.id}`}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium ${catMeta.badgeClass}`}
                        >
                          {renderHabitCategoryIcon(catMeta.iconKey, `w-3 h-3 shrink-0 ${catMeta.iconClass}`)}
                          <span>{catLabel}</span>
                        </span>
                        {h.reminderTime ? (
                          <span
                            data-testid={`habit-reminder-${h.id}`}
                            className="inline-flex items-center gap-1 font-mono tabular-nums text-cyan-600 dark:text-cyan-400"
                          >
                            <Bell className="w-3 h-3 shrink-0" />
                            {h.reminderTime}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </label>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(h)}
                      aria-label={`Edit ${displayTitle}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-slate-200/60 dark:hover:bg-white/5 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteHabit(h.id)}
                      aria-label={`Delete ${displayTitle}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ProgressRing
                      percent={percent}
                      size={36}
                      strokeWidth={3.5}
                      colorClass={doneToday ? 'stroke-emerald-500' : 'stroke-cyan-500'}
                      label={`${completedDays}`}
                    />
                  </div>
                </div>

                {/* Streak & 7-Day Completion History Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 dark:border-white/5 text-xs">
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span
                      data-testid={`habit-streak-${h.id}`}
                      className={`inline-flex items-center gap-1 font-semibold ${
                        displayStreak > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5 shrink-0" />
                      {isAr ? `سلسلة ${displayStreak} يوم` : `${displayStreak}d streak`}
                    </span>
                    {displayBest > displayStreak && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isAr ? `الأفضل: ${displayBest}ي` : `Best: ${displayBest}d`}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      · {completedDays}/{h.targetDays}d
                    </span>
                  </div>

                  <div
                    data-testid={`habit-history-${h.id}`}
                    aria-label={isAr ? 'سجل آخر ٧ أيام' : 'Last 7 days completion history'}
                    className="flex items-center gap-1"
                  >
                    {recentHistory.map((day) => (
                      <span
                        key={day.date}
                        title={`${day.date}: ${day.done ? (isAr ? 'مكتمل' : 'Done') : (isAr ? 'غير مكتمل' : 'Missed')}`}
                        className={`w-2.5 h-2.5 rounded-[3px] transition-colors ${
                          day.done
                            ? 'bg-emerald-500'
                            : day.date === dateStr
                              ? 'bg-slate-300 dark:bg-white/20 ring-1 ring-cyan-500/50'
                              : 'bg-slate-200 dark:bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={
          editingHabit
            ? isAr ? 'تعديل العادة' : 'Edit Habit'
            : isAr ? 'تعريف عادة جديدة' : 'Define Daily Habit'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {!editingHabit && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {isAr ? 'قوالب سريعة' : 'Quick Presets'}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HABIT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-xs font-medium hover:border-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  >
                    {isAr ? preset.titleAr : preset.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isAr ? 'اسم العادة *' : 'Habit Name *'}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder={isAr ? 'مثال: تأمل ١٠ دقائق' : 'e.g., Meditation (10m) or Drink 2.5L Water'}
              className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isAr ? 'الاسم بالعربية (اختياري)' : 'Arabic Label (optional)'}
            </span>
            <input
              type="text"
              value={titleAr}
              onChange={(e) => setTitleAr(e.target.value)}
              placeholder={isAr ? 'اسم العرض بالعربية' : 'Optional Arabic display label'}
              className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm"
            />
          </label>

          <div className="space-y-1.5">
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {isAr ? 'تصنيف العادة' : 'Category Tag'}
            </span>
            <div
              role="radiogroup"
              aria-label={isAr ? 'تصنيف العادة' : 'Category Tag'}
              className="grid grid-cols-2 sm:grid-cols-3 gap-2"
            >
              {HABIT_CATEGORIES.map((c) => {
                const selected = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-testid={`habit-category-option-${c.id}`}
                    onClick={() => setCategory(c.id)}
                    className={`min-h-[40px] flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors text-start ${
                      selected
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-700 dark:text-cyan-200'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    {renderHabitCategoryIcon(c.iconKey, `w-4 h-4 shrink-0 ${c.iconClass}`)}
                    <span className="truncate">{isAr ? c.ar : c.en}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'الهدف (أيام)' : 'Target Window (days)'}
              </span>
              <input
                type="number"
                min={1}
                max={365}
                value={targetDays}
                onChange={(e) => setTargetDays(e.target.value)}
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono tabular-nums"
              />
            </label>

            <div className="block">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <label htmlFor="habit-reminder-time">
                  {isAr ? 'وقت التذكير (اختياري)' : 'Reminder time (optional)'}
                </label>
                {reminderTime && (
                  <button
                    type="button"
                    onClick={() => setReminderTime('')}
                    aria-label={isAr ? 'مسح وقت التذكير' : 'Clear reminder time'}
                    className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    {isAr ? 'مسح' : 'Clear'}
                  </button>
                )}
              </div>
              <input
                id="habit-reminder-time"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono tabular-nums"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {isAr
              ? 'يرسل النظام تنبيهاً في الوقت المحدد (خارج ساعات الهدوء) إذا لم تكتمل العادة بعد.'
              : 'Sends an alert at this time (outside quiet hours) when notifications are enabled and the habit is still pending today.'}
          </p>

          {formError && (
            <div role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
            >
              {editingHabit ? t.common.save : isAr ? 'إضافة العادة' : 'Create Habit'}
            </button>
          </div>
        </form>
      </BottomSheet>
    </section>
  );
};
