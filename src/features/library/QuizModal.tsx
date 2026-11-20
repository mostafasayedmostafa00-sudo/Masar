import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { BottomSheet } from '../../components/BottomSheet';
import { aiClient, QuizQuestion } from '../../services/aiClient';
import { getT } from '../../utils/i18n';

export const QuizModal: React.FC = () => {
  const { state, quizPromptTopic, closeQuizPrompt, logQuizResult, pushToast } = useMasar();
  const t = getT(state.language);
  const isAr = state.language === 'ar';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setError(null);
  }, [quizPromptTopic?.topicId]);

  if (!quizPromptTopic) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await aiClient.generateQuiz(
        quizPromptTopic.topicTitle,
        quizPromptTopic.notes,
        quizPromptTopic.courseTitle,
        state.language
      );
      setQuestions(res.questions.slice(0, 5));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.offlineAi);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    let score = 0;
    const weak: string[] = [];
    for (const q of questions) {
      const userAns = (answers[q.id] || '').trim().toLowerCase();
      const target = q.correctAnswer.trim().toLowerCase();
      const isMatch = q.type === 'mcq' ? userAns === target : userAns.length > 3 && (userAns.includes(target.slice(0, 6)) || target.includes(userAns.slice(0, 6)));
      if (isMatch) score++;
      else weak.push(q.question);
    }
    setSubmitted(true);
    logQuizResult({
      topicId: quizPromptTopic.topicId,
      topicTitle: quizPromptTopic.topicTitle,
      date: state.activeDate,
      score,
      total: questions.length,
      weakAreas: weak,
    });
    pushToast(`Quiz score: ${score}/${questions.length}`, 'success');
  };

  return (
    <BottomSheet
      open={!!quizPromptTopic}
      onClose={closeQuizPrompt}
      title={isAr ? `اختبار التحقق: ${quizPromptTopic.topicTitle}` : `Verification Quiz: ${quizPromptTopic.topicTitle}`}
      maxWidthClass="md:max-w-2xl"
    >
      <div className="space-y-4 text-sm">
        {questions.length === 0 ? (
          <div className="space-y-3 py-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {isAr
                ? 'أتممت دراسة الموضوع! اختبر استيعابك بـ ٥ أسئلة سريعة لتحسين دقة التحليلات.'
                : 'Topic completed! Generate a 5-question verification quiz to test real understanding.'}
            </p>
            {error && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-700 dark:text-amber-300">
                {error}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleGenerate}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-cyan-600 text-white text-xs font-medium disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {loading ? (isAr ? 'جارٍ التوليد...' : 'Generating 5 Questions...') : isAr ? 'توليد ٥ أسئلة' : 'Generate 5-Question Quiz'}
              </button>
              <button
                type="button"
                onClick={closeQuizPrompt}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium"
              >
                {isAr ? 'لاحقاً' : 'Maybe later'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={q.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-3.5 space-y-2">
                <div className="text-xs font-semibold">
                  {idx + 1}. {q.question}
                </div>
                {q.type === 'mcq' && q.options ? (
                  <div className="space-y-1.5">
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] text-xs cursor-pointer"
                      >
                        <input
                          type="radio"
                          name={q.id}
                          disabled={submitted}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    disabled={submitted}
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder={isAr ? 'اكتب إجابتك باختصار...' : 'Short answer...'}
                    className="w-full min-h-[40px] px-3 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs"
                  />
                )}
                {submitted && (
                  <div className="text-xs pt-1 text-emerald-600 dark:text-emerald-400">
                    Answer: {q.correctAnswer} — {q.explanation}
                  </div>
                )}
              </div>
            ))}
            {!submitted ? (
              <button
                type="button"
                onClick={handleSubmit}
                className="w-full min-h-[44px] rounded-xl bg-emerald-600 text-white font-medium"
              >
                {isAr ? 'تصحيح الاختبار' : 'Submit Quiz'}
              </button>
            ) : (
              <button
                type="button"
                onClick={closeQuizPrompt}
                className="w-full min-h-[44px] rounded-xl bg-cyan-600 text-white font-medium"
              >
                {t.common.close}
              </button>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
