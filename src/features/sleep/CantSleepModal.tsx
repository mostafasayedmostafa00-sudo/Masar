import React, { useEffect, useState } from 'react';
import { Moon, Play, Pause, RotateCcw } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { BottomSheet } from '../../components/BottomSheet';

export const CantSleepModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { state } = useMasar();
  const isAr = state.language === 'ar';
  const [seconds, setSeconds] = useState(20 * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isAr ? 'مؤقت عدم القدرة على النوم (٢٠ دقيقة)' : "Can't Sleep — 20-Minute Routine"}
    >
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
          <Moon className="w-6 h-6" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {isAr
            ? 'إذا لم تنم خلال ٢٠ دقيقة، غادر السرير واقرأ كتاباً ورقياً في إضاءة خافتة ثم عد عند الشعور بالنعاس.'
            : 'Routine suggestion (not medical treatment): If you are still awake after 20 minutes, get out of bed, do something calm without screens, and return when sleepy.'}
        </p>

        <div className="py-5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-4xl font-bold tabular-nums">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {running ? (isAr ? 'إيقاف' : 'Pause') : isAr ? 'بدء ٢٠ دقيقة' : 'Start 20m'}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setSeconds(20 * 60);
            }}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-white/15 text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            {isAr ? 'إعادة' : 'Reset'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
