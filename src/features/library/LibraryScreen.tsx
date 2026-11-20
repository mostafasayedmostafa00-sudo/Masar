import React from 'react';
import { useMasar } from '../../app/MasarContext';
import { getT } from '../../utils/i18n';
import { LearnEngineView } from './LearnEngineView';
import { MindCompassView } from './MindCompassView';
import { PdfReaderView } from './PdfReaderView';
import { QueuesView } from './QueuesView';
import { ReadingNovelsView } from './ReadingNovelsView';
import { ResearchView } from './ResearchView';
import { SpeakingView } from './SpeakingView';
import { WorkoutView } from './WorkoutView';

export type LibrarySubTab = 'courses' | 'learn' | 'pdfs' | 'reading' | 'research' | 'workout' | 'speaking' | 'mind';

export const LibraryScreen: React.FC<{
  subTab: LibrarySubTab;
  onChangeSubTab: (sub: LibrarySubTab) => void;
}> = ({ subTab, onChangeSubTab }) => {
  const { state } = useMasar();
  const t = getT(state.language);

  const tabs: Array<{ id: LibrarySubTab; label: string }> = [
    { id: 'courses', label: t.library.courses },
    { id: 'learn', label: t.library.learn },
    { id: 'pdfs', label: t.library.pdfs },
    { id: 'reading', label: t.library.reading },
    { id: 'research', label: t.library.research },
    { id: 'workout', label: t.library.workout },
    { id: 'speaking', label: t.library.speaking },
    { id: 'mind', label: t.library.mind },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeSubTab(tab.id)}
            className={`min-h-[40px] px-3.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 border transition-colors ${
              subTab === tab.id
                ? 'bg-cyan-600 border-cyan-600 text-white'
                : 'bg-white dark:bg-[#0E131E] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'courses' && <QueuesView />}
      {subTab === 'learn' && <LearnEngineView />}
      {subTab === 'pdfs' && <PdfReaderView />}
      {subTab === 'reading' && <ReadingNovelsView />}
      {subTab === 'research' && <ResearchView />}
      {subTab === 'workout' && <WorkoutView />}
      {subTab === 'speaking' && <SpeakingView />}
      {subTab === 'mind' && <MindCompassView />}
    </div>
  );
};
