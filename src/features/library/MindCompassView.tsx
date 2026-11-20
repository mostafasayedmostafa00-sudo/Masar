import React, { useState } from 'react';
import { Compass, Sparkles } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { MIND_FRAMEWORKS } from '../../data/seed';
import { aiClient } from '../../services/aiClient';
import { MindFrameworkId } from '../../types/masar';

const QUICK_FEELINGS = [
  { id: 'exhausted', en: 'Mental exhaustion', ar: 'إرهاق ذهني', mapped: 'stoicism' as MindFrameworkId },
  { id: 'ungrateful', en: 'Not appreciating what I have', ar: 'عدم تقدير ما أملك', mapped: 'epicureanism' as MindFrameworkId },
  { id: 'overthinking', en: 'Overthinking', ar: 'كثرة التفكير', mapped: 'pragmatism' as MindFrameworkId },
  { id: 'shallow', en: 'Shallow relationships', ar: 'سطحية العلاقات', mapped: 'confucianism' as MindFrameworkId },
  { id: 'lost', en: 'Feeling lost', ar: 'الشعور بالضياع', mapped: 'transcendentalism' as MindFrameworkId },
];

export const MindCompassView: React.FC = () => {
  const { state, updateState, pushToast } = useMasar();
  const isAr = state.language === 'ar';

  const [selectedTag, setSelectedTag] = useState('overthinking');
  const [weighingText, setWeighingText] = useState('');
  const [activeFramework, setActiveFramework] = useState<MindFrameworkId>('pragmatism');
  const [practiceResponse, setPracticeResponse] = useState('');
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const fw = MIND_FRAMEWORKS[activeFramework];

  const handleRecommend = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await aiClient.recommendMindFramework(weighingText, selectedTag, state.language);
      if (MIND_FRAMEWORKS[res.framework]) {
        setActiveFramework(res.framework);
      }
      setAiRationale(`${res.rationale} — ${res.practicePrompt}`);
    } catch (err) {
      // Fallback to clear deterministic tag mapping while informing user AI was unavailable
      const fallback = QUICK_FEELINGS.find((f) => f.id === selectedTag)?.mapped || 'stoicism';
      setActiveFramework(fallback);
      setAiError(err instanceof Error ? err.message : 'AI unavailable offline.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!practiceResponse.trim()) return;
    updateState((p) => ({
      ...p,
      mindEntries: [
        {
          id: `mind-${Date.now()}`,
          date: p.activeDate,
          weighingOnMe: weighingText.trim() || selectedTag,
          framework: activeFramework,
          practiceResponse: practiceResponse.trim(),
        },
        ...p.mindEntries,
      ],
    }));
    setPracticeResponse('');
    setWeighingText('');
    pushToast(isAr ? 'تم حفظ التأمل في السجل.' : 'Reflection saved to Mind Compass journal.', 'success');
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-3.5 text-xs text-slate-600 dark:text-slate-400">
        {isAr
          ? 'بوصلة العقل أداة تأمل فلسفي يومية — وليست تشخيصاً طبياً أو علاجاً نفسياً.'
          : 'Mind Compass is a structured philosophical reflection tool, not medical or psychological therapy.'}
      </div>

      {/* Check-in */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-500" />
          <h2 className="text-base font-semibold">{isAr ? 'ما الذي يشغل بالك الآن؟' : "What's weighing on me?"}</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_FEELINGS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setSelectedTag(f.id);
                setActiveFramework(f.mapped);
              }}
              className={`min-h-[38px] px-3 rounded-xl border text-xs font-medium transition-colors ${
                selectedTag === f.id
                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                  : 'border-slate-200 dark:border-white/10'
              }`}
            >
              {isAr ? f.ar : f.en}
            </button>
          ))}
        </div>

        <textarea
          rows={2}
          value={weighingText}
          onChange={(e) => setWeighingText(e.target.value)}
          placeholder={isAr ? 'اكتب بحرية عما تشعر به أو تفكر فيه...' : 'Optional free text on what is weighing on your mind...'}
          className="w-full p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs"
        />

        <button
          type="button"
          disabled={aiLoading}
          onClick={handleRecommend}
          className="min-h-[42px] inline-flex items-center gap-2 px-4 rounded-xl bg-violet-600 text-white text-xs font-medium disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {aiLoading ? '...' : isAr ? 'ترشيح التأمل الأنسب بالذكاء الاصطناعي' : 'AI Recommend Reflection'}
        </button>

        {aiError && <div className="text-xs text-amber-600 dark:text-amber-400">{aiError}</div>}
        {aiRationale && (
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/25 text-xs text-violet-900 dark:text-violet-200">
            {aiRationale}
          </div>
        )}
      </section>

      {/* Active Philosophical Practice */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(MIND_FRAMEWORKS) as MindFrameworkId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveFramework(id)}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-medium ${
                activeFramework === id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300'
              }`}
            >
              {isAr ? MIND_FRAMEWORKS[id].nameAr : MIND_FRAMEWORKS[id].name}
            </button>
          ))}
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] space-y-1 text-xs">
          <div className="font-semibold text-cyan-600 dark:text-cyan-400">
            {isAr ? fw.nameAr : fw.name} · {isAr ? fw.forStateAr : fw.forState}
          </div>
          <p className="text-sm text-slate-800 dark:text-slate-200">{isAr ? fw.practiceAr : fw.practice}</p>
        </div>

        <form onSubmit={handleSaveEntry} className="space-y-2.5 text-xs">
          <textarea
            rows={3}
            required
            value={practiceResponse}
            onChange={(e) => setPracticeResponse(e.target.value)}
            placeholder={fw.promptPlaceholder}
            className="w-full p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          />
          <button type="submit" className="min-h-[42px] px-5 rounded-xl bg-cyan-600 text-white font-medium">
            {isAr ? 'حفظ في السجل' : 'Save Reflection'}
          </button>
        </form>
      </section>

      {/* Journal History */}
      {state.mindEntries.length > 0 && (
        <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-2.5">
          <h3 className="text-sm font-semibold">{isAr ? 'سجل التأملات' : 'Reflection History'}</h3>
          <div className="space-y-2 text-xs">
            {state.mindEntries.map((entry) => (
              <div key={entry.id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] space-y-1">
                <div className="text-cyan-600 dark:text-cyan-400 font-medium">
                  {entry.date} · {MIND_FRAMEWORKS[entry.framework].name} · {entry.weighingOnMe}
                </div>
                <p className="text-slate-700 dark:text-slate-300">{entry.practiceResponse}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
