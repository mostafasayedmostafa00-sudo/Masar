import React, { useMemo, useState } from 'react';
import {
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  HelpCircle,
  Layers,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { useMasar } from '../app/MasarContext';
import { QueueId, SectionContentType } from '../types/masar';
import {
  ParsedCourseContent,
  allocateCourseContentForDate,
  buildCourseFromParsedOutline,
  formatMinutesAsEffort,
  getCourseContentProgress,
  parseCourseOutlineContent,
} from '../utils/courseContentPlanner';
import { addDays } from '../utils/planner';
import { BottomSheet } from './BottomSheet';

const SAMPLE_RHSA_OUTLINE = `Section A.1: Red Hat System Administration I
Section A.2: Orientation to the Classroom Environment
Section A.3: Performing Lab Exercises

Chapter 1: Introduction to Red Hat Enterprise Linux
Section 1.1: Getting Started with Red Hat Enterprise Linux
Section 1.2: Quiz: Getting Started with Red Hat Enterprise Linux
Section 1.3: Summary

Chapter 2: Accessing the Command Line
Section 2.1: Accessing the Command Line in a Text Interface
Section 2.2: Quiz: Accessing the Command Line in a Text Interface
Section 2.3: Accessing the Command Line with the Desktop Environment
Section 2.4: Guided Exercise: Access the Command Line with the Desktop Environment
Section 2.5: Executing Commands with the Bash Shell
Section 2.6: Quiz: Executing Commands with the Bash Shell
Section 2.7: Lab: Access the Command Line
Section 2.8: Summary`;

export function sectionTypeLabel(type: SectionContentType | undefined, isAr: boolean): string {
  switch (type) {
    case 'quiz':
      return isAr ? 'اختبار' : 'Quiz';
    case 'guided_exercise':
      return isAr ? 'تمرين موجه' : 'Guided Exercise';
    case 'lab':
      return isAr ? 'معمل' : 'Lab';
    case 'summary':
      return isAr ? 'ملخص' : 'Summary';
    case 'review':
      return isAr ? 'مراجعة' : 'Review';
    case 'section':
    default:
      return isAr ? 'درس' : 'Section';
  }
}

export function sectionTypeIcon(type: SectionContentType | undefined) {
  switch (type) {
    case 'quiz':
      return <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-hidden="true" />;
    case 'guided_exercise':
      return <ListChecks className="w-3.5 h-3.5 text-cyan-500 shrink-0" aria-hidden="true" />;
    case 'lab':
      return <FlaskConical className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />;
    case 'summary':
      return <BookOpenCheck className="w-3.5 h-3.5 text-violet-500 shrink-0" aria-hidden="true" />;
    case 'review':
      return <Sparkles className="w-3.5 h-3.5 text-pink-500 shrink-0" aria-hidden="true" />;
    case 'section':
    default:
      return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />;
  }
}

export const ContentCoursePlannerModal: React.FC<{
  open: boolean;
  onClose: () => void;
  defaultQueue?: QueueId;
}> = ({ open, onClose, defaultQueue = 'extra' }) => {
  const { state, addContentPlannedCourse } = useMasar();
  const isAr = state.language === 'ar';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [queue, setQueue] = useState<QueueId>(defaultQueue);
  const [courseTitleOverride, setCourseTitleOverride] = useState('');
  const [rawOutline, setRawOutline] = useState('');
  const [parsed, setParsed] = useState<ParsedCourseContent | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(() => addDays(state.activeDate, 20));
  const [dailyHours, setDailyHours] = useState('1.5');
  const [makeCurrent, setMakeCurrent] = useState(true);

  React.useEffect(() => {
    if (open) {
      setQueue(defaultQueue);
      setStep(1);
      setParseError(null);
      setDeadline(addDays(state.activeDate, 20));
    }
  }, [open, defaultQueue, state.activeDate]);

  const handleParse = () => {
    if (!rawOutline.trim()) {
      setParseError(
        isAr ? 'الرجاء لصق محتوى أو فهرس الدورة أولاً.' : 'Please paste the course outline or content first.'
      );
      return;
    }
    const result = parseCourseOutlineContent(rawOutline, courseTitleOverride);
    if (result.totalSections === 0) {
      setParseError(
        isAr ? 'لم يتم التعرف على فصول أو أقسام. تأكد من تنسيق النص.' : 'Could not detect chapters or sections. Check the pasted outline.'
      );
      return;
    }
    setParseError(null);
    setParsed(result);
    if (!courseTitleOverride.trim()) {
      setCourseTitleOverride(result.courseTitle);
    }
  };

  const effectiveParsed = useMemo<ParsedCourseContent | null>(() => {
    if (!parsed) return null;
    return {
      ...parsed,
      courseTitle: courseTitleOverride.trim() || parsed.courseTitle,
    };
  }, [parsed, courseTitleOverride]);

  const planPreview = useMemo(() => {
    if (!effectiveParsed) return null;
    const hoursNum = Math.max(0.25, Math.min(12, Number(dailyHours) || 1.5));
    const draftCourse = buildCourseFromParsedOutline({
      id: 'preview-course',
      queue,
      order: 1,
      parsed: effectiveParsed,
      startDate: state.activeDate,
      deadline: deadline || addDays(state.activeDate, 20),
      dailyStudyHours: hoursNum,
      makeCurrent: true,
    });
    const draftState = {
      ...state,
      courses: [...state.courses.filter((c) => c.queue !== queue), draftCourse],
    };
    const progress = getCourseContentProgress(draftCourse, draftState, state.activeDate);
    let firstAllocation = allocateCourseContentForDate(draftState, draftCourse, state.activeDate);
    if (firstAllocation.pendingItems.length === 0) {
      for (let offset = 1; offset <= 14; offset++) {
        const candidateDate = addDays(state.activeDate, offset);
        const candidate = allocateCourseContentForDate(draftState, draftCourse, candidateDate);
        if (candidate.pendingItems.length > 0) {
          firstAllocation = candidate;
          break;
        }
      }
    }
    return { progress, todayAllocation: firstAllocation, hoursNum };
  }, [effectiveParsed, dailyHours, queue, state, deadline]);

  const handleConfirmPlan = () => {
    if (!effectiveParsed) return;
    const hoursNum = Math.max(0.25, Math.min(12, Number(dailyHours) || 1.5));
    addContentPlannedCourse({
      queue,
      parsed: effectiveParsed,
      deadline: deadline || addDays(state.activeDate, 20),
      dailyStudyHours: hoursNum,
      makeCurrent,
    });
    setRawOutline('');
    setCourseTitleOverride('');
    setParsed(null);
    setStep(1);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isAr ? 'تخطيط دورة حسب المحتوى' : 'Content-Based Course Planning'}
      maxWidthClass="md:max-w-2xl"
    >
      <div data-testid="content-course-planner-modal" className="space-y-4 text-sm">
        {/* Step Indicator */}
        <div className="flex items-center gap-2 text-xs">
          {[
            { id: 1 as const, label: isAr ? '١. لصق المحتوى' : '1. Course Content' },
            { id: 2 as const, label: isAr ? '٢. الموعد النهائي' : '2. Deadline' },
            { id: 3 as const, label: isAr ? '٣. وقت الدراسة' : '3. Study Time & Plan' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={s.id > 1 && !effectiveParsed}
              onClick={() => setStep(s.id)}
              className={`flex-1 min-h-[36px] px-2.5 rounded-xl border text-center font-medium transition-colors disabled:opacity-40 ${
                step === s.id
                  ? 'bg-cyan-600 border-cyan-600 text-white'
                  : step > s.id
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* STEP 1: PASTE & PARSE CONTENT */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr ? 'المسار (Queue)' : 'Target Queue'}
                </span>
                <select
                  aria-label={isAr ? 'المسار' : 'Target Queue'}
                  value={queue}
                  onChange={(e) => setQueue(e.target.value as QueueId)}
                  className="mt-1 w-full min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold uppercase"
                >
                  <option value="nti">NTI</option>
                  <option value="extra">EXTRA</option>
                  <option value="activity">ACTIVITY</option>
                  <option value="language">LANGUAGE</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr ? 'اسم الدورة (اختياري — يُكتشف تلقائياً)' : 'Course Name (optional — auto-detected)'}
                </span>
                <input
                  type="text"
                  data-testid="content-planner-course-title"
                  value={courseTitleOverride}
                  onChange={(e) => setCourseTitleOverride(e.target.value)}
                  placeholder={isAr ? 'مثال: Red Hat System Administration I' : 'e.g. Red Hat System Administration I'}
                  className="mt-1 w-full min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs"
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="course-outline-textarea" className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'الصق محتوى وفهرس الدورة (الفصول، الأقسام، الاختبارات، التمارين، المعامل، الملخصات)'
                    : 'Paste course content / outline (Chapters, Sections, Quizzes, Guided Exercises, Labs, Summaries)'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setRawOutline(SAMPLE_RHSA_OUTLINE);
                    const res = parseCourseOutlineContent(SAMPLE_RHSA_OUTLINE);
                    setParsed(res);
                    setCourseTitleOverride(res.courseTitle);
                    setParseError(null);
                  }}
                  className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:underline shrink-0"
                >
                  {isAr ? 'تجربة مثال جاهز' : 'Load sample outline'}
                </button>
              </div>
              <textarea
                id="course-outline-textarea"
                data-testid="content-planner-textarea"
                rows={7}
                value={rawOutline}
                onChange={(e) => setRawOutline(e.target.value)}
                placeholder={`Chapter 1: Introduction\nSection 1.1: Getting Started\nSection 1.2: Quiz: Getting Started\nSection 1.3: Summary`}
                className="w-full p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-xs leading-relaxed"
              />
            </div>

            {parseError && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                {parseError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="content-planner-parse-btn"
                onClick={handleParse}
                className="min-h-[42px] inline-flex items-center gap-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium"
              >
                <Layers className="w-4 h-4" />
                {isAr ? 'تحليل المحتوى وبناء الهيكل' : 'Parse Content'}
              </button>

              {effectiveParsed && (
                <button
                  type="button"
                  data-testid="content-planner-next-step2"
                  onClick={() => setStep(2)}
                  className="min-h-[42px] inline-flex items-center gap-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium ms-auto"
                >
                  {isAr ? 'التالي: تحديد الموعد النهائي' : 'Next: Set Deadline'}
                </button>
              )}
            </div>

            {/* Parsed Hierarchy Preview */}
            {effectiveParsed && (
              <div
                data-testid="content-planner-parsed-preview"
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] p-3.5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold">
                      {effectiveParsed.courseTitle}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {effectiveParsed.chapters.length} {isAr ? 'فصول' : 'chapters'} · {effectiveParsed.totalSections}{' '}
                      {isAr ? 'عنصر محتوى' : 'items'} · {formatMinutesAsEffort(effectiveParsed.totalMinutes, isAr)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {(['section', 'quiz', 'guided_exercise', 'lab', 'summary', 'review'] as SectionContentType[])
                      .filter((t) => effectiveParsed.countsByType[t] > 0)
                      .map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 font-medium"
                        >
                          {sectionTypeIcon(t)}
                          {effectiveParsed.countsByType[t]} {sectionTypeLabel(t, isAr)}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="max-h-44 overflow-y-auto space-y-2 pe-1">
                  {effectiveParsed.chapters.map((ch, idx) => (
                    <div key={idx} className="rounded-xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-2.5">
                      <div className="text-xs font-semibold flex items-center justify-between gap-2">
                        <span className="truncate">{ch.title}</span>
                        <span className="text-[11px] font-mono text-slate-500 shrink-0">
                          {ch.items.length} · ~{ch.estimatedMinutes}m
                        </span>
                      </div>
                      <ul className="mt-1.5 space-y-1">
                        {ch.items.map((it, iIdx) => (
                          <li key={iIdx} className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                            <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                              {sectionTypeIcon(it.sectionType)}
                              <span className="truncate">{it.title}</span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">~{it.estimatedMinutes}m</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: ASK FOR DEADLINE */}
        {step === 2 && effectiveParsed && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-semibold">
                <Calendar className="w-4 h-4" />
                <span>{effectiveParsed.courseTitle}</span>
              </div>
              <label className="block space-y-1.5">
                <span className="block text-base font-semibold text-slate-900 dark:text-white">
                  {isAr ? 'متى تريد إنهاء هذه الدورة؟' : 'When do you want to finish this course?'}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'سيوزع مخطط مَسَار OS المحتوى عبر أيام الدراسة المتاحة حتى هذا الموعد (مع احترام أيام السفر/الإجازة والتعويض).'
                    : 'Masar OS will distribute the sections across your available study days up to this deadline, respecting Travel/Off and Catch-up rules.'}
                </span>
                <input
                  type="date"
                  data-testid="content-planner-deadline-input"
                  value={deadline}
                  min={state.activeDate}
                  onChange={(e) => e.target.value && setDeadline(e.target.value)}
                  className="mt-2 w-full sm:w-64 min-h-[44px] px-3 rounded-xl bg-white dark:bg-[#07090F] border border-slate-300 dark:border-white/15 font-mono text-sm"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium"
              >
                {isAr ? 'السابق' : 'Back'}
              </button>
              <button
                type="button"
                data-testid="content-planner-next-step3"
                onClick={() => setStep(3)}
                className="min-h-[42px] px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium"
              >
                {isAr ? 'التالي: وقت الدراسة اليومي' : 'Next: Study Time'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ASK FOR REALISTIC STUDY TIME & PREVIEW */}
        {step === 3 && effectiveParsed && planPreview && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 text-xs font-semibold">
                <Clock className="w-4 h-4" />
                <span>
                  {effectiveParsed.courseTitle} · {deadline}
                </span>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="daily-study-hours-input"
                  className="block text-base font-semibold text-slate-900 dark:text-white"
                >
                  {isAr
                    ? 'كم من الوقت تريد تخصيصه واقعياً لهذه الدورة في كل يوم دراسة؟'
                    : 'How much time do you realistically want to spend on this course on each study day?'}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'هذا التقدير لتنظيم الوتيرة فقط — الهدف هو إتمام المحتوى المطلوب وليس مجرد ملء الوقت.'
                    : 'This is an estimate for pacing only — the goal is to finish the required content, not fill a fixed timer.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {['0.5', '1', '1.5', '2', '2.5', '3'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDailyHours(preset)}
                    className={`min-h-[38px] px-3 rounded-xl border font-mono text-xs font-medium ${
                      dailyHours === preset
                        ? 'bg-cyan-600 border-cyan-600 text-white'
                        : 'bg-white dark:bg-[#0E131E] border-slate-200 dark:border-white/10'
                    }`}
                  >
                    {preset}h/day
                  </button>
                ))}
                <div className="inline-flex items-center gap-1.5">
                  <input
                    id="daily-study-hours-input"
                    data-testid="content-planner-hours-input"
                    type="number"
                    min={0.25}
                    max={12}
                    step={0.25}
                    value={dailyHours}
                    onChange={(e) => setDailyHours(e.target.value)}
                    className="w-20 min-h-[38px] px-2.5 rounded-xl bg-white dark:bg-[#07090F] border border-slate-300 dark:border-white/15 font-mono text-xs"
                  />
                  <span className="text-xs text-slate-500">{isAr ? 'ساعة/يوم' : 'hours/day'}</span>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={makeCurrent}
                  onChange={(e) => setMakeCurrent(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>
                  {isAr
                    ? `تفعيل الدورة كدورة حالية في مسار ${queue.toUpperCase()} فوراً`
                    : `Activate immediately as current course in ${queue.toUpperCase()} queue`}
                </span>
              </label>
            </div>

            {/* Generated Daily Schedule Preview */}
            <div
              data-testid="content-planner-schedule-preview"
              className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4 space-y-2.5 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {isAr ? 'معاينة خطة التوزيع اليومي' : 'Daily Content Plan Preview'}
                </span>
                <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                  {planPreview.progress.availableStudyDays} {isAr ? 'أيام دراسة متاحة' : 'study days'} ·{' '}
                  {effectiveParsed.totalSections} {isAr ? 'أقسام' : 'sections'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="rounded-xl bg-white dark:bg-[#0E131E] p-2.5 border border-slate-200 dark:border-white/10">
                  <div className="text-slate-500">{isAr ? 'إجمالي المجهود المقدر' : 'Total Content'}</div>
                  <div className="mt-0.5 font-mono font-semibold">
                    {effectiveParsed.totalSections} items ({planPreview.progress.estimatedRemainingHours}h)
                  </div>
                </div>
                <div className="rounded-xl bg-white dark:bg-[#0E131E] p-2.5 border border-slate-200 dark:border-white/10">
                  <div className="text-slate-500">{isAr ? 'الانتهاء المتوقع' : 'Est. Finish'}</div>
                  <div className="mt-0.5 font-mono font-semibold">
                    {planPreview.progress.estimatedCompletionDate || deadline}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1 rounded-xl bg-white dark:bg-[#0E131E] p-2.5 border border-slate-200 dark:border-white/10">
                  <div className="text-slate-500">{isAr ? 'الحالة' : 'Pacing Status'}</div>
                  <div className="mt-0.5 font-semibold text-cyan-600 dark:text-cyan-400">
                    {planPreview.progress.status === 'ahead'
                      ? isAr ? 'متقدم' : 'Ahead'
                      : planPreview.progress.status === 'behind'
                        ? isAr ? 'يتطلب وتيرة أسرع' : 'Behind (auto-adjusted)'
                        : isAr ? 'على المسار' : 'On Track'}
                  </div>
                </div>
              </div>

              {planPreview.todayAllocation.pendingItems.length > 0 && (
                <div className="pt-1">
                  <div className="text-[11px] font-medium text-slate-500 mb-1">
                    {isAr
                      ? `أول كتلة دراسة (${planPreview.todayAllocation.date}) — ${formatMinutesAsEffort(planPreview.todayAllocation.remainingMinutesToday, isAr)}:`
                      : `First study block (${planPreview.todayAllocation.date}) — ${formatMinutesAsEffort(planPreview.todayAllocation.remainingMinutesToday, isAr)}:`}
                  </div>
                  <ul className="space-y-1">
                    {planPreview.todayAllocation.pendingItems.map((it) => (
                      <li key={it.itemId} className="flex items-center justify-between gap-2 text-slate-700 dark:text-slate-200">
                        <span className="truncate">→ {it.itemTitle}</span>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">~{it.estimatedMinutes}m</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium"
              >
                {isAr ? 'السابق' : 'Back'}
              </button>
              <button
                type="button"
                data-testid="content-planner-confirm-btn"
                onClick={handleConfirmPlan}
                className="min-h-[44px] inline-flex items-center gap-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isAr ? 'اعتماد خطة الدورة والبدء' : 'Create Course Plan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
