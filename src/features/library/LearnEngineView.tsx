import React, { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, BrainCircuit, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { LEARNING_RESOURCES } from '../../data/seed';
import { aiClient, FeynmanResult } from '../../services/aiClient';
import { getT } from '../../utils/i18n';
import { getCurrentCourse } from '../../utils/planner';

export const LearnEngineView: React.FC = () => {
  const { state, updateState, markTopicRecalled, pushToast } = useMasar();
  const t = getT(state.language);
  const isAr = state.language === 'ar';

  const currentNti = getCurrentCourse(state.courses, 'nti');
  const activeTopics = currentNti?.topics || [];
  const [selectedTopicId, setSelectedTopicId] = useState(activeTopics[0]?.id || '');
  const selectedTopic = activeTopics.find((tp) => tp.id === selectedTopicId) || activeTopics[0];

  // First 20 Hours AI
  const [f20Loading, setF20Loading] = useState(false);
  const [f20Error, setF20Error] = useState<string | null>(null);

  // Active Recall State
  const [notesHidden, setNotesHidden] = useState(true);
  const [recallDraft, setRecallDraft] = useState('');
  const [missedDraft, setMissedDraft] = useState('');
  const [recallTimerSec, setRecallTimerSec] = useState(0);
  const [recallRunning, setRecallRunning] = useState(false);

  // Feynman AI State
  const [feynmanText, setFeynmanText] = useState('');
  const [feynmanLoading, setFeynmanLoading] = useState(false);
  const [feynmanError, setFeynmanError] = useState<string | null>(null);
  const [feynmanResult, setFeynmanResult] = useState<FeynmanResult | null>(null);

  useEffect(() => {
    if (!recallRunning) return;
    const id = window.setInterval(() => setRecallTimerSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recallRunning]);

  const illusionAlerts = state.courses
    .flatMap((c) => c.topics)
    .filter((tp) => (tp.studied && !tp.recalled) || tp.rewatchCount >= 2);

  const handleGenerateFirst20 = async () => {
    if (!currentNti) return;
    setF20Loading(true);
    setF20Error(null);
    try {
      const res = await aiClient.generateFirst20Hours(currentNti.title, currentNti.queue, state.language);
      updateState((p) => ({
        ...p,
        courses: p.courses.map((c) =>
          c.id === currentNti.id
            ? {
                ...c,
                first20Hours: {
                  ...res,
                  hoursLogged: c.first20Hours?.hoursLogged ?? 0,
                },
              }
            : c
        ),
      }));
      pushToast(isAr ? 'تم توليد خطة أول ٢٠ ساعة.' : 'First 20 Hours plan updated.', 'success');
    } catch (err) {
      setF20Error(err instanceof Error ? err.message : t.common.offlineAi);
    } finally {
      setF20Loading(false);
    }
  };

  const handleCompleteRecall = () => {
    if (!currentNti || !selectedTopic) return;
    setRecallRunning(false);
    const missed = missedDraft
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    markTopicRecalled(currentNti.id, selectedTopic.id, Math.max(60, recallTimerSec), missed);
    setRecallTimerSec(0);
    setRecallDraft('');
    setMissedDraft('');
  };

  const handleFeynmanCheck = async () => {
    if (!selectedTopic || feynmanText.trim().length < 15) return;
    setFeynmanLoading(true);
    setFeynmanError(null);
    try {
      const res = await aiClient.evaluateFeynman(selectedTopic.title, feynmanText, state.language);
      setFeynmanResult(res);
      if (currentNti) {
        updateState((p) => ({
          ...p,
          courses: p.courses.map((c) =>
            c.id === currentNti.id
              ? {
                  ...c,
                  topics: c.topics.map((tp) =>
                    tp.id === selectedTopic.id
                      ? { ...tp, feynmanScore: res.score, feynmanGaps: res.knowledgeGaps }
                      : tp
                  ),
                }
              : c
          ),
        }));
      }
    } catch (err) {
      setFeynmanError(err instanceof Error ? err.message : t.common.offlineAi);
    } finally {
      setFeynmanLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Illusion of Mastery Guard */}
      {illusionAlerts.length > 0 && (
        <section className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <div className="font-semibold">
              {isAr ? 'حارس وهم الإتقان' : 'Illusion of Mastery Guard'}
            </div>
            <p className="mt-0.5">
              {isAr
                ? 'لقد شاهدت/قرأت هذه المواضيع ولكنك لم تثبت استرجاعها من الذاكرة بعد:'
                : 'You consumed the material, but have not demonstrated recall yet:'}{' '}
              <span className="font-medium">{illusionAlerts.map((x) => x.title).join(', ')}</span>
            </p>
          </div>
        </section>
      )}

      {/* First 20 Hours */}
      {currentNti && (
        <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">
                {isAr ? 'قانون أول ٢٠ ساعة — جاش كوفمان' : 'First 20 Hours Deconstruction'}
              </div>
              <h2 className="text-base font-semibold">{currentNti.title}</h2>
            </div>
            <button
              type="button"
              disabled={f20Loading}
              onClick={handleGenerateFirst20}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 rounded-xl bg-cyan-600 text-white text-xs font-medium disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {f20Loading ? '...' : isAr ? 'تحليل بالذكاء الاصطناعي' : 'AI Deconstruct'}
            </button>
          </div>

          {f20Error && <p className="text-xs text-amber-600 dark:text-amber-400">{f20Error}</p>}

          {currentNti.first20Hours && (
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between mb-1 font-mono tabular-nums">
                  <span>{isAr ? 'مقياس الـ ٢٠ ساعة' : '20-Hour Deliberate Meter'}</span>
                  <span>{currentNti.first20Hours.hoursLogged} / 20h</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full"
                    style={{ width: `${Math.min(100, (currentNti.first20Hours.hoursLogged / 20) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-3">
                  <div className="font-semibold mb-1">{isAr ? 'المهارات الفرعية' : 'Key Subskills'}</div>
                  <ul className="space-y-1 list-disc list-inside text-slate-600 dark:text-slate-300">
                    {currentNti.first20Hours.subskills.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-3">
                  <div className="font-semibold mb-1">{isAr ? 'أفضل المصادر' : 'Best Resources'}</div>
                  <ul className="space-y-1 list-disc list-inside text-slate-600 dark:text-slate-300">
                    {currentNti.first20Hours.resources.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-3">
                  <div className="font-semibold mb-1">{isAr ? 'العوائق الشائعة' : 'Common Barriers'}</div>
                  <ul className="space-y-1 list-disc list-inside text-slate-600 dark:text-slate-300">
                    {currentNti.first20Hours.barriers.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Active Recall + Feynman Workspace */}
      {selectedTopic && (
        <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{isAr ? 'الاسترجاع النشط + تقنية فاينمان' : 'Active Recall & Feynman Lab'}</h2>
            <select
              aria-label="Select topic for recall"
              value={selectedTopic.id}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs max-w-full"
            >
              {activeTopics.map((tp) => (
                <option key={tp.id} value={tp.id}>
                  {tp.title} ({tp.recalled ? 'Recalled' : tp.studied ? 'Studied only' : 'Pending'})
                </option>
              ))}
            </select>
          </div>

          {/* Active Recall Flow */}
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-3.5 space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold">
                1. {isAr ? 'إخفاء الملاحظات واسترجاع من الذاكرة (الهدف ~١٠ دقائق)' : 'Hide notes & recall from memory (~10m target)'}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs tabular-nums">
                  {Math.floor(recallTimerSec / 60)}:{String(recallTimerSec % 60).padStart(2, '0')}
                </span>
                <button
                  type="button"
                  onClick={() => setRecallRunning((r) => !r)}
                  className="min-h-[36px] px-3 rounded-lg bg-cyan-600 text-white text-xs font-medium"
                >
                  {recallRunning ? 'Pause' : 'Start 10m'}
                </button>
                <button
                  type="button"
                  onClick={() => setNotesHidden((h) => !h)}
                  className="min-h-[36px] inline-flex items-center gap-1 px-3 rounded-lg border border-slate-300 dark:border-white/15 text-xs"
                >
                  {notesHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {notesHidden ? (isAr ? 'كشف المخطط' : 'Reveal Outline') : isAr ? 'إخفاء' : 'Hide'}
                </button>
              </div>
            </div>

            {!notesHidden && (
              <div className="p-3 rounded-lg bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs space-y-1">
                <div className="font-semibold">{selectedTopic.title}</div>
                {selectedTopic.items.map((it) => (
                  <div key={it.id}>• {it.title}</div>
                ))}
                {selectedTopic.notes && <div className="text-slate-500 mt-1">{selectedTopic.notes}</div>}
              </div>
            )}

            <textarea
              rows={3}
              value={recallDraft}
              onChange={(e) => setRecallDraft(e.target.value)}
              placeholder={isAr ? 'اكتب كل ما تتذكره بدون النظر للمصادر...' : 'Write everything you recall from memory without looking...'}
              className="w-full p-3 rounded-xl bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs"
            />
            <textarea
              rows={2}
              value={missedDraft}
              onChange={(e) => setMissedDraft(e.target.value)}
              placeholder={isAr ? 'النقاط التي نسيتها (سطر لكل نقطة — تصبح مراجعة متباعدة)...' : 'Missed points after revealing outline (one per line -> scheduled for spaced review)...'}
              className="w-full p-3 rounded-xl bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs"
            />
            <button
              type="button"
              onClick={handleCompleteRecall}
              className="min-h-[42px] px-4 rounded-xl bg-emerald-600 text-white text-xs font-medium"
            >
              {isAr ? 'توثيق الاسترجاع النشط' : 'Mark Recalled & Queue Missed Points'}
            </button>
          </div>

          {/* Feynman Technique */}
          <div className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <BrainCircuit className="w-4 h-4 text-violet-500" />
              <span>{isAr ? 'تقنية فاينمان — اشرح المفهوم ببساطة' : 'Feynman Technique — Explain Simply'}</span>
            </div>
            <textarea
              rows={3}
              value={feynmanText}
              onChange={(e) => setFeynmanText(e.target.value)}
              placeholder={isAr ? 'اشرح الموضوع كأنك تشرحه لمبتدئ بدون مصطلحات معقدة...' : 'Explain this topic in plain language as if to a beginner...'}
              className="w-full p-3 rounded-xl bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10 text-xs"
            />
            <button
              type="button"
              disabled={feynmanLoading || feynmanText.trim().length < 15}
              onClick={handleFeynmanCheck}
              className="min-h-[42px] inline-flex items-center gap-2 px-4 rounded-xl bg-violet-600 text-white text-xs font-medium disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {feynmanLoading ? (isAr ? 'جارٍ التقييم...' : 'Evaluating...') : isAr ? 'تحليل فاينمان بالذكاء الاصطناعي' : 'Analyze Explanation'}
            </button>

            {feynmanError && <p className="text-xs text-amber-600 dark:text-amber-400">{feynmanError}</p>}

            {feynmanResult && (
              <div className="p-3 rounded-xl bg-white dark:bg-[#07090F] border border-violet-500/30 text-xs space-y-2">
                <div className="font-semibold font-mono">Score: {feynmanResult.score}/100</div>
                <p>{feynmanResult.feedback}</p>
                {feynmanResult.knowledgeGaps.length > 0 && (
                  <div>
                    <span className="font-semibold text-amber-500">Knowledge gaps:</span>{' '}
                    {feynmanResult.knowledgeGaps.join(' · ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 5 Curated Learning Science Resources */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-500" />
          <h2 className="text-base font-semibold">{isAr ? 'مراجع علم التعلم' : 'Learning Science Library'}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {LEARNING_RESOURCES.map((res) => (
            <a
              key={res.id}
              href={res.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-200 dark:border-white/10 p-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors block"
            >
              <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">{res.author}</div>
              <div className="text-sm font-medium mt-0.5">{res.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{res.principle}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
};
