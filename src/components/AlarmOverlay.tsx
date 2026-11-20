import React, { useEffect, useRef } from 'react';
import { BellRing, Clock, Play, SkipForward } from 'lucide-react';
import { DailyTask } from '../types/masar';
import { useMasar } from '../app/MasarContext';

export const AlarmOverlay: React.FC<{
  task: DailyTask | null;
  onStart: () => void;
  onSnooze: () => void;
  onSkip: () => void;
  onDismiss: () => void;
}> = ({ task, onStart, onSnooze, onSkip, onDismiss }) => {
  const { state } = useMasar();
  const isAr = state.language === 'ar';
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!task) return;
    let intervalId: number | null = null;

    const playChime = () => {
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = audioCtxRef.current || new AudioCtx();
        audioCtxRef.current = ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } catch {
        // Browser may block autoplay audio without prior gesture
      }
    };

    playChime();
    intervalId = window.setInterval(playChime, 4000);

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [task]);

  if (!task) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-label={isAr ? 'منبه المهمة' : 'Task Alarm'}
    >
      <div className="w-full max-w-md rounded-3xl bg-[#0E131E] border border-cyan-500/30 p-6 text-center shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <BellRing className="w-7 h-7" />
        </div>
        <div className="mt-4 font-mono text-xs text-cyan-400 tabular-nums">
          {task.scheduledTime} · {task.category.toUpperCase()}
        </div>
        <h2 className="mt-2 text-xl font-bold text-white text-balance">{task.title}</h2>
        <p className="mt-1.5 text-sm text-slate-300">
          {isAr ? 'ابدأ موضوعك الحالي — الأولوية لإتمام الموضوع.' : 'Start your current topic — focus on topic completion.'}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-2.5">
          <button
            type="button"
            onClick={onStart}
            className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition-colors"
          >
            <Play className="w-4 h-4" />
            {isAr ? 'بدء المهمة الآن' : 'Start Topic Now'}
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onSnooze}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 text-slate-200 text-sm font-medium hover:bg-white/5"
            >
              <Clock className="w-4 h-4" />
              {isAr ? 'تأجيل ١٥د' : 'Snooze 15m'}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 text-slate-200 text-sm font-medium hover:bg-white/5"
            >
              <SkipForward className="w-4 h-4" />
              {isAr ? 'تخطي وإعادة جدولة' : 'Skip & Replan'}
            </button>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[44px] text-xs text-slate-400 hover:text-slate-200"
          >
            {isAr ? 'إغلاق المنبه' : 'Dismiss'}
          </button>
        </div>

        <p className="mt-4 text-[11px] text-slate-500">
          {isAr
            ? 'ملاحظة: منبهات الويب تعمل أثناء فتح التطبيق؛ لتنبيهات النظام المضمونة صدّر التقويم (.ics).'
            : 'Browser limitation: Web alarms chime while the app is open. Export .ics calendar for native OS alarms.'}
        </p>
      </div>
    </div>
  );
};
