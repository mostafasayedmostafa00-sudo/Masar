import React, { useState } from 'react';
import { useMasar } from '../../app/MasarContext';
import { BottomSheet } from '../../components/BottomSheet';
import { DailyTask } from '../../types/masar';

export const QuickNotesSheet: React.FC<{
  task: DailyTask | null;
  onClose: () => void;
}> = ({ task, onClose }) => {
  const { state, updateTaskNotes, pushToast } = useMasar();
  const isAr = state.language === 'ar';

  const [notes, setNotes] = useState(task?.notes || '');
  const [whatILearned, setWhatILearned] = useState(task?.whatILearned || '');
  const [whatBlockedMe, setWhatBlockedMe] = useState(task?.whatBlockedMe || '');
  const [keyCommand, setKeyCommand] = useState(task?.keyCommand || '');
  const [keyConcept, setKeyConcept] = useState(task?.keyConcept || '');

  React.useEffect(() => {
    if (task) {
      setNotes(task.notes || '');
      setWhatILearned(task.whatILearned || '');
      setWhatBlockedMe(task.whatBlockedMe || '');
      setKeyCommand(task.keyCommand || '');
      setKeyConcept(task.keyConcept || '');
    }
  }, [task]);

  if (!task) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateTaskNotes(task.date, task.id, {
      notes,
      whatILearned,
      whatBlockedMe,
      keyCommand,
      keyConcept,
    });
    pushToast(isAr ? 'تم حفظ الملاحظات.' : 'Notes saved & indexed for search.', 'success');
    onClose();
  };

  return (
    <BottomSheet open={!!task} onClose={onClose} title={task.title}>
      <form onSubmit={handleSave} className="space-y-3.5 text-sm">
        <label className="block">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'ملاحظة سريعة' : 'Quick note'}
          </span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'ماذا تعلمت؟' : 'What I learned'}
          </span>
          <textarea
            rows={2}
            value={whatILearned}
            onChange={(e) => setWhatILearned(e.target.value)}
            className="mt-1 w-full p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isAr ? 'ما الذي عطلني؟' : 'What blocked me'}
          </span>
          <input
            type="text"
            value={whatBlockedMe}
            onChange={(e) => setWhatBlockedMe(e.target.value)}
            className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'أمر / تقنية أساسية' : 'Key command / technique'}
            </span>
            <input
              type="text"
              value={keyCommand}
              onChange={(e) => setKeyCommand(e.target.value)}
              className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-xs"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? 'مفهوم أساسي' : 'Key concept'}
            </span>
            <input
              type="text"
              value={keyConcept}
              onChange={(e) => setKeyConcept(e.target.value)}
              className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
            />
          </label>
        </div>
        <button
          type="submit"
          className="w-full min-h-[44px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
        >
          {isAr ? 'حفظ الملاحظات' : 'Save Notes'}
        </button>
      </form>
    </BottomSheet>
  );
};
