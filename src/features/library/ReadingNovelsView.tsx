import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Headphones, Plus } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { ProgressRing } from '../../components/ProgressRing';

export const ReadingNovelsView: React.FC = () => {
  const { state, updateState, logBookPages, pushToast } = useMasar();
  const isAr = state.language === 'ar';

  const novels = [...state.books].filter((b) => b.category === 'novel').sort((a, b) => a.order - b.order);
  const currentNovel = novels.find((b) => b.status === 'current') || novels[0];

  const [pageInput, setPageInput] = useState(String(currentNovel?.currentPage || 0));
  const [quoteText, setQuoteText] = useState('');
  const [ideaText, setIdeaText] = useState('');

  const [podTitle, setPodTitle] = useState('');
  const [podMins, setPodMins] = useState('30');

  const moveNovel = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= novels.length) return;
    const reordered = [...novels];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(nextIdx, 0, moved);
    updateState((p) => ({
      ...p,
      books: p.books.map((b) => {
        const foundIdx = reordered.findIndex((r) => r.id === b.id);
        return foundIdx !== -1 ? { ...b, order: foundIdx + 1 } : b;
      }),
    }));
  };

  const setCurrentBook = (bookId: string) => {
    updateState((p) => ({
      ...p,
      books: p.books.map((b) =>
        b.category === 'novel'
          ? { ...b, status: b.id === bookId ? 'current' : b.currentPage >= b.totalPages ? 'completed' : 'upcoming' }
          : b
      ),
    }));
  };

  const handleAddQuoteOrIdea = (type: 'quote' | 'idea') => {
    if (!currentNovel) return;
    const val = type === 'quote' ? quoteText.trim() : ideaText.trim();
    if (!val) return;
    updateState((p) => ({
      ...p,
      books: p.books.map((b) =>
        b.id === currentNovel.id
          ? {
              ...b,
              quotes: type === 'quote' ? [...b.quotes, val] : b.quotes,
              ideas: type === 'idea' ? [...b.ideas, val] : b.ideas,
            }
          : b
      ),
    }));
    if (type === 'quote') setQuoteText('');
    else setIdeaText('');
    pushToast(isAr ? 'تم الحفظ في سجل الكتاب.' : 'Saved to book notes.', 'success');
  };

  return (
    <div className="space-y-5">
      {/* Current Novel Spotlight */}
      {currentNovel && (
        <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                {isAr ? 'الرواية الحالية' : 'Current Novel'} · #{currentNovel.order}
              </div>
              <h2 className="text-lg font-bold mt-0.5">{currentNovel.title}</h2>
              <div className="text-xs text-slate-500">
                {currentNovel.author} · {currentNovel.currentPage}/{currentNovel.totalPages} pages · Target {currentNovel.dailyTargetPages} pages/day
              </div>
            </div>
            <ProgressRing
              percent={Math.round((currentNovel.currentPage / Math.max(1, currentNovel.totalPages)) * 100)}
              size={52}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              max={currentNovel.totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              className="w-24 min-h-[42px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => logBookPages(currentNovel.id, Number(pageInput) || 0)}
              className="min-h-[42px] px-4 rounded-xl bg-cyan-600 text-white text-xs font-medium"
            >
              {isAr ? 'تحديث الصفحة' : 'Log Page'}
            </button>
            <button
              type="button"
              onClick={() => {
                const next = Math.min(currentNovel.totalPages, currentNovel.currentPage + currentNovel.dailyTargetPages);
                setPageInput(String(next));
                logBookPages(currentNovel.id, next);
              }}
              className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium"
            >
              +{currentNovel.dailyTargetPages} pages
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-white/10">
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  placeholder={isAr ? 'أضف اقتباساً...' : 'Save a quote...'}
                  className="flex-1 min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                />
                <button
                  type="button"
                  onClick={() => handleAddQuoteOrIdea('quote')}
                  className="min-h-[40px] px-3 rounded-xl bg-violet-600 text-white font-medium"
                >
                  +
                </button>
              </div>
              {currentNovel.quotes.map((q, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.03] italic">“{q}”</div>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ideaText}
                  onChange={(e) => setIdeaText(e.target.value)}
                  placeholder={isAr ? 'أضف فكرة أو ملاحظة...' : 'Save an idea / note...'}
                  className="flex-1 min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                />
                <button
                  type="button"
                  onClick={() => handleAddQuoteOrIdea('idea')}
                  className="min-h-[40px] px-3 rounded-xl bg-cyan-600 text-white font-medium"
                >
                  +
                </button>
              </div>
              {currentNovel.ideas.map((idText, i) => (
                <div key={i} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.03]">• {idText}</div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 13 Novels Queue (Reorderable) */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-2.5">
        <h3 className="text-base font-semibold">{isAr ? 'قائمة الروايات (١٣ رواية)' : 'Novels Queue (13 Classics)'}</h3>
        <div className="divide-y divide-slate-200 dark:divide-white/10">
          {novels.map((b, idx) => (
            <div key={b.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">
                  {idx + 1}. {b.title}
                </div>
                <div className="text-slate-500 font-mono tabular-nums">
                  {b.currentPage}/{b.totalPages}p · {b.status}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {b.status !== 'current' && (
                  <button
                    type="button"
                    onClick={() => setCurrentBook(b.id)}
                    className="min-h-[36px] px-2.5 rounded-lg border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 font-medium"
                  >
                    {isAr ? 'تعيين حالي' : 'Set Current'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => moveNovel(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Move ${b.title} up`}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveNovel(idx, 1)}
                  disabled={idx === novels.length - 1}
                  aria-label={`Move ${b.title} down`}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Commute Podcasts */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Headphones className="w-4 h-4 text-violet-500" />
          <h3 className="text-base font-semibold">{isAr ? 'بودكاست المواصلات' : 'Commute Podcasts'}</h3>
        </div>
        <div className="space-y-2 text-xs">
          {state.podcasts.map((pod) => (
            <div key={pod.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
              <div className="min-w-0">
                <div className={`font-medium truncate ${pod.completed ? 'line-through text-slate-400' : ''}`}>{pod.title}</div>
                <div className="text-slate-500 font-mono tabular-nums">{pod.progressMinutes}/{pod.durationMinutes} min</div>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateState((p) => ({
                    ...p,
                    podcasts: p.podcasts.map((x) =>
                      x.id === pod.id ? { ...x, completed: !x.completed, progressMinutes: x.durationMinutes } : x
                    ),
                  }))
                }
                className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-white/10 font-medium"
              >
                {pod.completed ? 'Done' : 'Complete'}
              </button>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!podTitle.trim()) return;
            updateState((p) => ({
              ...p,
              podcasts: [
                ...p.podcasts,
                {
                  id: `pod-${Date.now()}`,
                  title: podTitle.trim(),
                  durationMinutes: Number(podMins) || 30,
                  progressMinutes: 0,
                  completed: false,
                },
              ],
            }));
            setPodTitle('');
          }}
          className="flex flex-wrap gap-2 text-xs"
        >
          <input
            type="text"
            value={podTitle}
            onChange={(e) => setPodTitle(e.target.value)}
            placeholder={isAr ? 'عنوان حلقة بودكاست...' : 'Add podcast episode...'}
            className="flex-1 min-w-[160px] min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          />
          <input
            type="number"
            value={podMins}
            onChange={(e) => setPodMins(e.target.value)}
            className="w-20 min-h-[40px] px-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono"
          />
          <button type="submit" className="min-h-[40px] px-4 rounded-xl bg-cyan-600 text-white font-medium inline-flex items-center gap-1">
            <Plus className="w-4 h-4" />
            Add
          </button>
        </form>
      </section>
    </div>
  );
};
