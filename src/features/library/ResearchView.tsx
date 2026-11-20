import React, { useState } from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { ResearchItem } from '../../types/masar';

export const ResearchView: React.FC = () => {
  const { state, updateState, pushToast } = useMasar();
  const isAr = state.language === 'ar';

  const [newSource, setNewSource] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [source, setSource] = useState(state.researchSources[0] || 'OpenAlex');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSource.trim()) return;
    updateState((p) => ({
      ...p,
      researchSources: p.researchSources.includes(newSource.trim())
        ? p.researchSources
        : [...p.researchSources, newSource.trim()],
    }));
    setNewSource('');
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const item: ResearchItem = {
      id: `res-${Date.now()}`,
      title: title.trim(),
      url: url.trim() || 'https://openalex.org/',
      source,
      tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
      notes: notes.trim(),
      status: 'to_read',
    };
    updateState((p) => ({ ...p, researchItems: [item, ...p.researchItems] }));
    setTitle('');
    setUrl('');
    setTags('');
    setNotes('');
    pushToast(isAr ? 'تمت إضافة مادة البحث.' : 'Research item saved.', 'success');
  };

  const summarizedCount = state.researchItems.filter((r) => r.status === 'summarized').length;

  return (
    <div className="space-y-5">
      {/* Sources Management */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">{isAr ? 'مصادر البحث القابلة للتعديل' : 'Research Sources'}</h2>
            <p className="text-xs text-slate-500 font-mono tabular-nums">
              Weekly goal: {summarizedCount}/{state.researchWeeklyGoal} summarized
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <span>{isAr ? 'الهدف الأسبوعي:' : 'Weekly goal:'}</span>
            <input
              type="number"
              min={1}
              max={20}
              value={state.researchWeeklyGoal}
              onChange={(e) =>
                updateState((p) => ({ ...p, researchWeeklyGoal: Math.max(1, Number(e.target.value) || 2) }))
              }
              className="w-14 min-h-[36px] px-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {state.researchSources.map((src) => (
            <div
              key={src}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
            >
              <span>{src}</span>
              <button
                type="button"
                aria-label={`Remove source ${src}`}
                onClick={() =>
                  updateState((p) => ({
                    ...p,
                    researchSources: p.researchSources.filter((s) => s !== src),
                  }))
                }
                className="text-slate-400 hover:text-rose-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddSource} className="flex gap-2 text-xs">
          <input
            type="text"
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            placeholder={isAr ? 'إضافة مصدر بحث جديد...' : 'Add research source...'}
            className="flex-1 min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          />
          <button type="submit" className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-white/10 font-medium">
            + Source
          </button>
        </form>
      </section>

      {/* Add Research Item */}
      <section className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <h3 className="text-sm font-semibold">{isAr ? 'إضافة ورقة أو مقال بحثي' : 'Add Research Item'}</h3>
        <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isAr ? 'العنوان' : 'Title'}
            className="min-h-[42px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="min-h-[42px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="min-h-[42px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          >
            {state.researchSources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={isAr ? 'الوسوم (مفصولة بفاصلة)' : 'Tags (comma separated)'}
            className="min-h-[42px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          />
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isAr ? 'ملخص أو ملاحظات...' : 'Key notes...'}
            className="sm:col-span-2 p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          />
          <button
            type="submit"
            className="sm:col-span-2 min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 text-white font-medium"
          >
            <Plus className="w-4 h-4" />
            {isAr ? 'حفظ في البحث' : 'Save Research Item'}
          </button>
        </form>
      </section>

      {/* Research Items */}
      <section className="space-y-2.5">
        {state.researchItems.map((item) => (
          <div key={item.id} className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-cyan-600 dark:text-cyan-400 font-medium">
                  {item.source} {item.tags.length ? `· ${item.tags.join(', ')}` : ''}
                </div>
                <h4 className="text-sm font-semibold mt-0.5">{item.title}</h4>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  aria-label={`Status for ${item.title}`}
                  value={item.status}
                  onChange={(e) =>
                    updateState((p) => ({
                      ...p,
                      researchItems: p.researchItems.map((r) =>
                        r.id === item.id ? { ...r, status: e.target.value as ResearchItem['status'] } : r
                      ),
                    }))
                  }
                  className="min-h-[36px] px-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                >
                  <option value="to_read">To read</option>
                  <option value="reading">Reading</option>
                  <option value="summarized">Summarized</option>
                </select>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${item.title}`}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/10"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  aria-label={`Delete ${item.title}`}
                  onClick={() =>
                    updateState((p) => ({
                      ...p,
                      researchItems: p.researchItems.filter((r) => r.id !== item.id),
                    }))
                  }
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-rose-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {item.notes && <p className="text-slate-600 dark:text-slate-300">{item.notes}</p>}
          </div>
        ))}
      </section>
    </div>
  );
};
