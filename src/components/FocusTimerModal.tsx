import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useMasar } from '../app/MasarContext';
import { QueueId } from '../types/masar';
import { BottomSheet } from './BottomSheet';

export const FocusTimerModal: React.FC<{
  open: boolean;
  onClose: () => void;
  defaultCategory?: QueueId | 'reading' | 'other';
  defaultTopicTitle?: string;
  defaultTopicId?: string;
}> = ({ open, onClose, defaultCategory = 'nti', defaultTopicTitle, defaultTopicId }) => {
  const { state, logFocusSession, pushToast } = useMasar();
  const isAr = state.language === 'ar';

  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [phase, setPhase] = useState<'work' | 'break'>('work');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [category, setCategory] = useState<QueueId | 'reading' | 'other'>(defaultCategory);
  const [elapsedWorkSec, setElapsedWorkSec] = useState(0);

  useEffect(() => {
    setCategory(defaultCategory);
  }, [defaultCategory]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (phase === 'work') {
            setPhase('break');
            pushToast(isAr ? 'انتهت جلسة التركيز! وقت الراحة.' : 'Focus block complete! Break started.', 'success');
            return breakMinutes * 60;
          } else {
            setRunning(false);
            setPhase('work');
            return workMinutes * 60;
          }
        }
        return prev - 1;
      });
      if (phase === 'work') {
        setElapsedWorkSec((s) => s + 1);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, phase, breakMinutes, workMinutes, isAr, pushToast]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const handleSaveSession = () => {
    const loggedMins = Math.max(1, Math.round(elapsedWorkSec / 60));
    logFocusSession({
      date: state.activeDate,
      startedAt: new Date().toISOString(),
      category,
      topicId: defaultTopicId,
      topicTitle: defaultTopicTitle,
      plannedMinutes: workMinutes,
      actualMinutes: loggedMins,
    });
    setRunning(false);
    setElapsedWorkSec(0);
    setSecondsLeft(workMinutes * 60);
    pushToast(
      isAr ? `تم تسجيل ${loggedMins} دقيقة في الإحصاءات.` : `Logged ${loggedMins} focus minutes to analytics.`,
      'success'
    );
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isAr ? 'مؤقت التركيز (Pomodoro)' : 'Focus Session Timer'}
    >
      <div className="space-y-5">
        {defaultTopicTitle && (
          <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium truncate">
            {defaultTopicTitle}
          </div>
        )}

        <div className="flex flex-col items-center justify-center py-6 rounded-2xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
            {phase === 'work' ? (isAr ? 'جلسة تركيز' : 'Focus Work') : isAr ? 'استراحة' : 'Short Break'}
          </div>
          <div className="font-mono text-5xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {isAr ? 'الوقت الفعلي المسجل:' : 'Logged elapsed:'} {Math.floor(elapsedWorkSec / 60)}m {elapsedWorkSec % 60}s
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {running ? (isAr ? 'إيقاف' : 'Pause') : isAr ? 'ابدأ' : 'Start'}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setPhase('work');
              setSecondsLeft(workMinutes * 60);
            }}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <RotateCcw className="w-4 h-4" />
            {isAr ? 'إعادة' : 'Reset'}
          </button>
          <button
            type="button"
            onClick={handleSaveSession}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isAr ? 'حفظ' : 'Log'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-white/10">
          <label className="block">
            <span className="text-xs text-slate-500 dark:text-slate-400">{isAr ? 'المسار المرتبط' : 'Linked Queue'}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as QueueId | 'reading' | 'other')}
              className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="nti">NTI</option>
              <option value="extra">Extra</option>
              <option value="activity">Activity</option>
              <option value="language">Language</option>
              <option value="reading">Reading</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 dark:text-slate-400">{isAr ? 'العمل (دقيقة)' : 'Work (min)'}</span>
            <input
              type="number"
              min={5}
              max={120}
              value={workMinutes}
              onChange={(e) => {
                const v = Math.max(5, Math.min(120, Number(e.target.value) || 25));
                setWorkMinutes(v);
                if (!running && phase === 'work') setSecondsLeft(v * 60);
              }}
              className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono tabular-nums"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 dark:text-slate-400">{isAr ? 'الراحة (دقيقة)' : 'Break (min)'}</span>
            <input
              type="number"
              min={1}
              max={30}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(Math.max(1, Math.min(30, Number(e.target.value) || 5)))}
              className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono tabular-nums"
            />
          </label>
        </div>
      </div>
    </BottomSheet>
  );
};
