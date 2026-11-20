import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useMasar } from '../app/MasarContext';
import { NavTab } from '../types/masar';
import { BottomSheet } from './BottomSheet';

interface SearchResult {
  id: string;
  kind: string;
  title: string;
  snippet: string;
  tab: NavTab;
  librarySub?: string;
}

export const GlobalSearchModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onNavigate: (tab: NavTab, librarySub?: string) => void;
}> = ({ open, onClose, onNavigate }) => {
  const { state } = useMasar();
  const [query, setQuery] = useState('');
  const isAr = state.language === 'ar';

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const list: SearchResult[] = [];

    // Courses & Topics & Notes
    for (const c of state.courses) {
      if (c.title.toLowerCase().includes(q) || (c.platform || '').toLowerCase().includes(q)) {
        list.push({
          id: `c-${c.id}`,
          kind: `Course · ${c.queue.toUpperCase()}`,
          title: c.title,
          snippet: `${c.topics.length} topics · ${c.status}`,
          tab: 'library',
          librarySub: 'courses',
        });
      }
      for (const t of c.topics) {
        const noteBlob = [t.title, t.notes, t.whatILearned, t.whatBlockedMe, t.keyCommand, t.keyConcept]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (noteBlob.includes(q)) {
          list.push({
            id: `t-${t.id}`,
            kind: 'Topic / Note',
            title: t.title,
            snippet: t.keyCommand || t.keyConcept || t.notes || c.title,
            tab: 'library',
            librarySub: 'learn',
          });
        }
      }
    }

    // Tasks & Task notes
    for (const [date, tasks] of Object.entries(state.tasksByDate)) {
      for (const tk of tasks) {
        const blob = [tk.title, tk.notes, tk.whatILearned, tk.keyCommand, tk.keyConcept].filter(Boolean).join(' ').toLowerCase();
        if (blob.includes(q)) {
          list.push({
            id: `tk-${tk.id}`,
            kind: `Task · ${date}`,
            title: tk.title,
            snippet: tk.notes || tk.whatILearned || tk.subtitle || tk.status,
            tab: 'today',
          });
        }
      }
    }

    // Books & Novels
    for (const b of state.books) {
      const blob = [b.title, b.author, b.notes, ...b.quotes, ...b.ideas].filter(Boolean).join(' ').toLowerCase();
      if (blob.includes(q)) {
        list.push({
          id: `b-${b.id}`,
          kind: 'Book',
          title: b.title,
          snippet: `${b.currentPage}/${b.totalPages} pages`,
          tab: 'library',
          librarySub: 'reading',
        });
      }
    }

    // Research
    for (const r of state.researchItems) {
      const blob = [r.title, r.source, r.notes, ...r.tags].join(' ').toLowerCase();
      if (blob.includes(q)) {
        list.push({
          id: `r-${r.id}`,
          kind: `Research · ${r.source}`,
          title: r.title,
          snippet: r.notes || r.url,
          tab: 'library',
          librarySub: 'research',
        });
      }
    }

    // PDFs & Highlights
    for (const pdf of state.pdfs) {
      if (pdf.name.toLowerCase().includes(q)) {
        list.push({
          id: `pdf-${pdf.id}`,
          kind: 'PDF',
          title: pdf.name,
          snippet: `Page ${pdf.lastPage}/${pdf.totalPages}`,
          tab: 'library',
          librarySub: 'pdfs',
        });
      }
      for (const hl of pdf.highlights) {
        if (hl.text.toLowerCase().includes(q) || (hl.note || '').toLowerCase().includes(q)) {
          list.push({
            id: `hl-${hl.id}`,
            kind: `Highlight · ${pdf.name}`,
            title: `Page ${hl.page}`,
            snippet: hl.text,
            tab: 'library',
            librarySub: 'pdfs',
          });
        }
      }
    }

    // Workout logs
    for (const wk of state.workoutLogs) {
      if ((wk.notes || '').toLowerCase().includes(q)) {
        list.push({
          id: `wk-${wk.id}`,
          kind: `Workout ${wk.planId} · ${wk.date}`,
          title: wk.notes || `Workout ${wk.planId}`,
          snippet: `${wk.durationMinutes} min`,
          tab: 'library',
          librarySub: 'workout',
        });
      }
    }

    // Mind reflections
    for (const m of state.mindEntries) {
      const blob = [m.weighingOnMe, m.practiceResponse, m.reflectionLine, m.framework].filter(Boolean).join(' ').toLowerCase();
      if (blob.includes(q)) {
        list.push({
          id: `m-${m.id}`,
          kind: `Mind Compass · ${m.framework}`,
          title: m.weighingOnMe,
          snippet: m.practiceResponse,
          tab: 'library',
          librarySub: 'mind',
        });
      }
    }

    return list.slice(0, 25);
  }, [query, state]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isAr ? 'البحث الشامل في مَسَار' : 'Global Search'}
      maxWidthClass="md:max-w-2xl"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isAr
                ? 'ابحث في الدورات، المواضيع، الملاحظات، الكتب، PDF، التأملات...'
                : 'Search courses, topics, notes, books, PDFs, highlights, reflections...'
            }
            className="w-full min-h-[44px] ps-10 pe-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        {!query.trim() ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            {isAr
              ? 'اكتب كلمة مفتاحية للبحث الفوري عبر كافة أنظمة مَسَار OS.'
              : 'Type a keyword to search across courses, tasks, notes, books, PDFs, and reflections.'}
          </p>
        ) : results.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            {isAr ? 'لا توجد نتائج مطابقة.' : 'No matching entries found.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate(r.tab, r.librarySub);
                    onClose();
                  }}
                  className="w-full text-start py-3 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">{r.kind}</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">{r.title}</div>
                  {r.snippet && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{r.snippet}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BottomSheet>
  );
};
