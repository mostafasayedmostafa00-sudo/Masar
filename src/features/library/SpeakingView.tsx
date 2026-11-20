import React, { useEffect, useRef, useState } from 'react';
import { Check, Mic, Play, Square } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { loadSpeakingAudio, saveSpeakingAudio } from '../../services/storage';

export const SpeakingView: React.FC = () => {
  const { state, updateState, pushToast } = useMasar();
  const isAr = state.language === 'ar';

  const nextPending = state.speakingDays.find((d) => !d.completed) || state.speakingDays[0];
  const [selectedDayNum, setSelectedDayNum] = useState(nextPending.day);
  const currentDay = state.speakingDays.find((d) => d.day === selectedDayNum) || state.speakingDays[0];

  const [timerSec, setTimerSec] = useState(0);
  const [timerOn, setTimerOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recError, setRecError] = useState<string | null>(null);

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!timerOn) return;
    const id = window.setInterval(() => setTimerSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerOn]);

  useEffect(() => {
    let active = true;
    setAudioUrl(null);
    loadSpeakingAudio(selectedDayNum)
      .then((blob) => {
        if (active && blob) {
          setAudioUrl(URL.createObjectURL(blob));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selectedDayNum]);

  const startRecording = async () => {
    setRecError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecError(isAr ? 'التسجيل الصوتي غير مدعوم في هذا المتصفح.' : 'Voice recording (MediaRecorder) is unavailable in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await saveSpeakingAudio(selectedDayNum, blob);
        setAudioUrl(URL.createObjectURL(blob));
        updateState((p) => ({
          ...p,
          speakingDays: p.speakingDays.map((d) =>
            d.day === selectedDayNum ? { ...d, hasRecording: true } : d
          ),
        }));
        stream.getTracks().forEach((t) => t.stop());
        pushToast(isAr ? 'تم حفظ التسجيل الصوتي محلياً.' : 'Recording saved locally.', 'success');
      };
      mr.start();
      mediaRecRef.current = mr;
      setRecording(true);
      setTimerOn(true);
    } catch {
      setRecError(isAr ? 'تم رفض إذن الميكروفون أو غير متاح.' : 'Microphone permission denied or unavailable.');
    }
  };

  const stopRecording = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
    setTimerOn(false);
  };

  const toggleCompleted = (dayNum: number) => {
    updateState((p) => ({
      ...p,
      speakingDays: p.speakingDays.map((d) =>
        d.day === dayNum
          ? {
              ...d,
              completed: !d.completed,
              completedDate: !d.completed ? p.activeDate : undefined,
              durationSeconds: timerSec || d.durationSeconds,
            }
          : d
      ),
    }));
  };

  const completedTotal = state.speakingDays.filter((d) => d.completed).length;

  return (
    <div className="space-y-5">
      {/* Active Day Practice */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
            Day {currentDay.day}/30 · {completedTotal}/30 completed
          </span>
          <span className="font-mono text-sm font-bold tabular-nums">
            {Math.floor(timerSec / 60)}:{String(timerSec % 60).padStart(2, '0')}
          </span>
        </div>
        <h2 className="text-lg font-bold">{isAr ? currentDay.topicAr : currentDay.topic}</h2>
        <p className="text-xs text-slate-600 dark:text-slate-300">{currentDay.instructions}</p>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => setTimerOn((t) => !t)}
            className="min-h-[42px] inline-flex items-center gap-1.5 px-4 rounded-xl bg-cyan-600 text-white text-xs font-medium"
          >
            <Play className="w-3.5 h-3.5" />
            {timerOn ? (isAr ? 'إيقاف المؤقت' : 'Pause Timer') : isAr ? 'بدء المؤقت' : 'Start Timer'}
          </button>

          {!recording ? (
            <button
              type="button"
              onClick={startRecording}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 rounded-xl border border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300 text-xs font-medium"
            >
              <Mic className="w-3.5 h-3.5" />
              {isAr ? 'تسجيل الصوت' : 'Record Voice'}
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 rounded-xl bg-rose-600 text-white text-xs font-medium"
            >
              <Square className="w-3.5 h-3.5" />
              {isAr ? 'إيقاف التسجيل' : 'Stop Recording'}
            </button>
          )}

          <button
            type="button"
            onClick={() => toggleCompleted(currentDay.day)}
            className={`min-h-[42px] inline-flex items-center gap-1.5 px-4 rounded-xl text-xs font-medium ${
              currentDay.completed
                ? 'bg-emerald-600 text-white'
                : 'border border-slate-300 dark:border-white/15'
            }`}
          >
            <Check className="w-4 h-4" />
            {currentDay.completed ? (isAr ? 'مكتمل' : 'Completed') : isAr ? 'إتمام اليوم' : 'Mark Completed'}
          </button>
        </div>

        {recError && <div className="text-xs text-amber-600 dark:text-amber-400">{recError}</div>}
        {audioUrl && (
          <div className="pt-2">
            <audio controls src={audioUrl} className="w-full h-10" />
          </div>
        )}
      </section>

      {/* 30-Day Grid (Missing a day never resets!) */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{isAr ? 'تحدي التحدث ٣٠ يوماً (لا يُعاد التصفير عند فوات يوم)' : '30-Day Challenge (missing a day never resets progress)'}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {state.speakingDays.map((d) => (
            <button
              key={d.day}
              type="button"
              onClick={() => {
                setSelectedDayNum(d.day);
                setTimerSec(0);
                setTimerOn(false);
              }}
              className={`min-h-[56px] p-2.5 rounded-xl border text-start text-xs transition-colors ${
                d.day === selectedDayNum
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : d.completed
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-slate-200 dark:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span>Day {d.day}</span>
                {d.completed && <Check className="w-3.5 h-3.5 text-emerald-500" />}
              </div>
              <div className="font-medium truncate mt-0.5">{isAr ? d.topicAr : d.topic}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
