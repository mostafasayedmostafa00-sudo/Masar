import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Trash2, Upload } from 'lucide-react';
import { useMasar } from '../app/MasarContext';
import { Language, QueueId, ThemeMode } from '../types/masar';
import { BottomSheet } from './BottomSheet';
import { PWAInstallButton } from './PWAInstallButton';

export const SettingsSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { state, setLanguage, setTheme, updateState, resetAllData, importBackupJson, pushToast } = useMasar();
  const isAr = state.language === 'ar';
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const movePriority = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= state.priorityOrder.length) return;
    updateState((prev) => {
      const copy = [...prev.priorityOrder];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return { ...prev, priorityOrder: copy };
    });
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `masar-os-backup-${state.activeDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(isAr ? 'تم تنزيل النسخة الاحتياطية JSON.' : 'JSON backup downloaded.', 'success');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const ok = importBackupJson(text);
    if (!ok) {
      pushToast(isAr ? 'ملف النسخة الاحتياطية غير صالح.' : 'Invalid backup JSON file.', 'warning');
    }
    e.target.value = '';
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={isAr ? 'الإعدادات' : 'Settings'} maxWidthClass="md:max-w-2xl">
      <div className="space-y-6 text-sm">
        {/* Appearance & Language */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'المظهر واللغة' : 'Appearance & Language'}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {(['en', 'ar'] as Language[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`min-h-[44px] rounded-xl border font-medium transition-colors ${
                  state.language === lang
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {lang === 'en' ? 'English (LTR)' : 'العربية (RTL)'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['dark', 'light', 'system'] as ThemeMode[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`min-h-[44px] rounded-xl border capitalize font-medium transition-colors ${
                  state.theme === t
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                    : 'border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        {/* Planning & Sleep Guard */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'التخطيط وحارس النوم' : 'Planning & Sleep Guard'}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs text-slate-500">{isAr ? 'الاستيقاظ' : 'Wake time'}</span>
              <input
                type="time"
                value={state.sleepSettings.wakeTime}
                onChange={(e) =>
                  updateState((p) => ({ ...p, sleepSettings: { ...p.sleepSettings, wakeTime: e.target.value } }))
                }
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">{isAr ? 'هدف النوم (س)' : 'Sleep target (h)'}</span>
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
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">{isAr ? 'بداية المساء' : 'Evening start'}</span>
              <input
                type="time"
                value={state.sleepSettings.eveningStartTime}
                onChange={(e) =>
                  updateState((p) => ({ ...p, sleepSettings: { ...p.sleepSettings, eveningStartTime: e.target.value } }))
                }
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono tabular-nums"
              />
            </label>
          </div>

          <div>
            <span className="text-xs text-slate-500">{isAr ? 'ترتيب الأولوية (لتقليص الفائض قبل النوم)' : 'Study Priority Order (Hard Sleep Rule)'}</span>
            <div className="mt-2 space-y-1.5">
              {state.priorityOrder.map((q: QueueId, idx: number) => (
                <div
                  key={q}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                >
                  <span className="font-medium uppercase text-xs">
                    {idx + 1}. {q}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => movePriority(idx, -1)}
                      disabled={idx === 0}
                      aria-label={`Move ${q} up`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-white/10 disabled:opacity-30"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePriority(idx, 1)}
                      disabled={idx === state.priorityOrder.length - 1}
                      aria-label={`Move ${q} down`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-white/10 disabled:opacity-30"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(['nti', 'extra', 'activity', 'language'] as QueueId[]).map((q) => (
              <label key={q} className="block">
                <span className="text-xs text-slate-500 uppercase">{q} (min)</span>
                <input
                  type="number"
                  min={15}
                  max={180}
                  value={state.blockDurations[q]}
                  onChange={(e) =>
                    updateState((p) => ({
                      ...p,
                      blockDurations: { ...p.blockDurations, [q]: Number(e.target.value) || 60 },
                    }))
                  }
                  className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono tabular-nums"
                />
              </label>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'الإشعارات وساعات الهدوء' : 'Notifications & Quiet Hours'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-500">{isAr ? 'بداية الهدوء' : 'Quiet start'}</span>
              <input
                type="time"
                value={state.notificationPrefs.quietHoursStart}
                onChange={(e) =>
                  updateState((p) => ({
                    ...p,
                    notificationPrefs: { ...p.notificationPrefs, quietHoursStart: e.target.value },
                  }))
                }
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono tabular-nums"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">{isAr ? 'نهاية الهدوء' : 'Quiet end'}</span>
              <input
                type="time"
                value={state.notificationPrefs.quietHoursEnd}
                onChange={(e) =>
                  updateState((p) => ({
                    ...p,
                    notificationPrefs: { ...p.notificationPrefs, quietHoursEnd: e.target.value },
                  }))
                }
                className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono tabular-nums"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                if (typeof Notification !== 'undefined') {
                  const p = await Notification.requestPermission();
                  updateState((prev) => ({
                    ...prev,
                    notificationPrefs: { ...prev.notificationPrefs, enabled: p === 'granted' },
                  }));
                  pushToast(`Notification permission: ${p}`, 'info');
                }
              }}
              className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5"
            >
              {state.notificationPrefs.enabled
                ? isAr ? 'الإذن ممنوح' : 'Permission: Granted'
                : isAr ? 'طلب إذن الإشعارات' : 'Request Permission'}
            </button>
            <PWAInstallButton language={state.language} />
          </div>
        </section>

        {/* Data Backup & Clear */}
        <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'النسخ الاحتياطي والبيانات المحلية' : 'Local Data Backup & Restore'}
          </h3>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleExportJson}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-cyan-600 text-white text-xs font-medium hover:bg-cyan-500"
            >
              <Download className="w-4 h-4" />
              {isAr ? 'تصدير JSON' : 'Export JSON'}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl border border-slate-300 dark:border-white/15 text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <Upload className="w-4 h-4" />
              {isAr ? 'استيراد JSON' : 'Import JSON'}
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />

            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium hover:bg-rose-500/10"
              >
                <Trash2 className="w-4 h-4" />
                {isAr ? 'مسح البيانات' : 'Clear Data'}
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await resetAllData();
                  setConfirmClear(false);
                  onClose();
                }}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-rose-600 text-white text-xs font-medium"
              >
                {isAr ? 'تأكيد المسح الكامل' : 'Confirm Reset All'}
              </button>
            )}
          </div>
        </section>

        {/* About */}
        <section className="pt-4 border-t border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Masar OS — مَسَار OS · v1.0.0</span>
          <span>Local-first IndexedDB + PWA</span>
        </section>
      </div>
    </BottomSheet>
  );
};
