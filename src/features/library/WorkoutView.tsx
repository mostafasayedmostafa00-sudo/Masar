import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Play, RotateCcw, Timer } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { EVENING_POSTURE_ITEMS, WORKOUT_PLANS } from '../../data/seed';

export const WorkoutView: React.FC = () => {
  const { state, completeWorkoutSession, pushToast } = useMasar();
  const isAr = state.language === 'ar';

  const [selectedPlan, setSelectedPlan] = useState<'A' | 'B' | 'C'>(state.nextWorkoutPlan);
  const plan = WORKOUT_PLANS[selectedPlan];

  const [setChecks, setSetChecks] = useState<Record<string, boolean[]>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [timerSec, setTimerSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerLabel, setTimerLabel] = useState('Rest / Plank Timer');

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerSec((s) => {
        if (s <= 1) {
          setTimerRunning(false);
          pushToast(isAr ? 'انتهى المؤقت!' : 'Timer complete!', 'info');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning, isAr, pushToast]);

  const startCountdown = (sec: number, label: string) => {
    setTimerSec(sec);
    setTimerLabel(label);
    setTimerRunning(true);
  };

  const toggleSet = (exId: string, setIdx: number, totalSets: number) => {
    setSetChecks((prev) => {
      const current = prev[exId] ? [...prev[exId]] : Array(totalSets).fill(false);
      current[setIdx] = !current[setIdx];
      return { ...prev, [exId]: current };
    });
  };

  const totalCompletedSets = Object.values(setChecks).reduce((acc, arr) => acc + arr.filter(Boolean).length, 0);
  const weeklyWorkouts = state.workoutLogs.length;

  return (
    <div className="space-y-5">
      {/* Honest Physiology & Pain Warning */}
      <div className="rounded-2xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-4 space-y-2 text-xs">
        <div className="flex items-start gap-2 text-amber-700 dark:text-amber-300 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {isAr
              ? 'تنبيه السلامة: توقف فوراً إذا شعرت بألم حاد في المفاصل أو الظهر.'
              : 'Safety cue: Stop immediately if sharp joint or spine pain occurs.'}
          </span>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          {isAr
            ? 'فقدان الدهون العام يتأثر بمجمل النشاط اليومي والتغذية المتوازنة (لا يوجد حرق موضعي لمنطقة البطن/الجانبين فقط).'
            : 'Fat reduction is driven by overall daily activity and nutrition balance — targeted exercises build strength and posture rather than spot-reducing fat.'}
        </p>
      </div>

      {/* Plan Selector + Live Rest/Plank Timer */}
      <div className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
            {(['A', 'B', 'C'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedPlan(id)}
                className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedPlan === id
                    ? 'bg-white dark:bg-cyan-600 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Workout {id}
              </button>
            ))}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500">
            Logged sessions: {weeklyWorkouts} · Sets ticked: {totalCompletedSets}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2 text-xs">
            <Timer className="w-4 h-4 text-cyan-500" />
            <span>{timerLabel}:</span>
            <span className="font-mono text-base font-bold tabular-nums">{timerSec}s</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => startCountdown(45, 'Rest')} className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs">45s Rest</button>
            <button type="button" onClick={() => startCountdown(60, 'Rest / Plank')} className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs">60s</button>
            <button type="button" onClick={() => { setTimerRunning(false); setTimerSec(0); }} aria-label="Reset timer" className="min-h-[36px] px-2 rounded-lg border border-slate-200 dark:border-white/10 text-xs">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Exercises List */}
      <div className="space-y-3">
        <h2 className="text-base font-bold px-1">{isAr ? plan.nameAr : plan.name}</h2>
        {plan.exercises.map((ex) => {
          const checks = setChecks[ex.id] || Array(ex.sets).fill(false);
          return (
            <div key={ex.id} className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{isAr ? ex.nameAr : ex.name}</div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    {ex.sets} × {ex.targetReps}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ex.isTimed && ex.durationSec && (
                    <button
                      type="button"
                      onClick={() => startCountdown(ex.durationSec!, ex.name)}
                      className="min-h-[36px] inline-flex items-center gap-1 px-2.5 rounded-lg bg-violet-600 text-white text-xs"
                    >
                      <Play className="w-3 h-3" />
                      {ex.durationSec}s
                    </button>
                  )}
                  <input
                    type="text"
                    placeholder="kg"
                    value={weights[ex.id] || ''}
                    onChange={(e) => setWeights((w) => ({ ...w, [ex.id]: e.target.value }))}
                    className="w-16 min-h-[36px] px-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-mono text-center"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{isAr ? ex.formTipAr : ex.formTip}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {Array.from({ length: ex.sets }).map((_, idx) => {
                  const done = checks[idx];
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleSet(ex.id, idx, ex.sets)}
                      className={`min-h-[40px] px-3.5 rounded-xl border text-xs font-mono font-medium inline-flex items-center gap-1.5 transition-colors ${
                        done
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 dark:border-white/15 hover:bg-slate-100 dark:hover:bg-white/5'
                      }`}
                    >
                      {done && <Check className="w-3.5 h-3.5" />}
                      Set {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {selectedPlan === 'C' && (
          <div className="rounded-2xl bg-cyan-500/10 border border-cyan-500/25 p-3 text-xs text-cyan-800 dark:text-cyan-200">
            {isAr ? 'تهدئة ٥ دقائق بعد التمرين C لتنزيل نبض القلب وإطالة العضلات.' : 'Include 5-minute cool-down walk & stretch after Workout C.'}
          </div>
        )}
      </div>

      {/* Notes + Complete Session (syncs Resistance Training habit!) */}
      <div className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={isAr ? 'ملاحظات التمرين أو التطور...' : 'Workout progression notes...'}
          className="w-full p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs"
        />
        <button
          type="button"
          onClick={() => completeWorkoutSession(selectedPlan, 40, notes)}
          className="w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
        >
          {isAr
            ? `إتمام التمرين ${selectedPlan} (يُحتسب في عادة المقاومة)`
            : `Complete Workout ${selectedPlan} (Syncs Resistance Training Habit)`}
        </button>
      </div>

      {/* Evening Posture 10m Break */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{isAr ? 'استقامة المساء (١٠ دقائق)' : 'Evening Posture Reset (10m)'}</h3>
            <p className="text-xs text-slate-500">{isAr ? 'للتخفيف من الجلوس أمام الشاشات' : 'Counteracts desk posture; 10m mobility on Travel/Off days'}</p>
          </div>
          <button
            type="button"
            onClick={() => completeWorkoutSession('posture', 10)}
            className="min-h-[40px] px-3.5 rounded-xl bg-cyan-600 text-white text-xs font-medium"
          >
            {isAr ? 'تسجيل ١٠د' : 'Log 10m'}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {EVENING_POSTURE_ITEMS.map((item) => (
            <div key={item.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
              <div className="font-semibold">{isAr ? item.nameAr : item.name} · {item.duration}</div>
              <div className="text-slate-500 mt-0.5">{item.tip}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
