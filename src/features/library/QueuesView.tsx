import React, { useState } from 'react';
import { ArrowRight, BookOpenCheck, Check, CheckCircle2, FilePlus2, Layers, Plus, Sparkles } from 'lucide-react';
import { useMasar } from '../../app/MasarContext';
import { BottomSheet } from '../../components/BottomSheet';
import {
  ContentCoursePlannerModal,
  sectionTypeIcon,
} from '../../components/ContentCoursePlannerModal';
import { ProgressRing } from '../../components/ProgressRing';
import { aiClient, ParsedCourseResult } from '../../services/aiClient';
import { Course, QueueId } from '../../types/masar';
import { getCourseContentProgress } from '../../utils/courseContentPlanner';
import { getT } from '../../utils/i18n';
import { calculatePacing, getCourseProgress } from '../../utils/planner';

export const QueuesView: React.FC = () => {
  const {
    state,
    updateState,
    markTopicStudied,
    toggleCourseItemCompleted,
    updateContentCourseSettings,
    promoteNextCourse,
    pushToast,
  } = useMasar();
  const t = getT(state.language);
  const isAr = state.language === 'ar';

  const [activeQueue, setActiveQueue] = useState<QueueId>('nti');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const selectedCourse = selectedCourseId ? state.courses.find((c) => c.id === selectedCourseId) ?? null : null;
  const [contentPlannerOpen, setContentPlannerOpen] = useState(false);

  // Add simple course (especially for empty Language queue)
  const [addCourseOpen, setAddCourseOpen] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newTopicTitle, setNewTopicTitle] = useState('');

  // Bulk Course Import with AI
  const [bulkOpen, setBulkOpen] = useState(false);
  const [outlineText, setOutlineText] = useState('Module 1\nTopic 1: Fundamentals\nTopic 2: Hands-on Lab\n\nModule 2\nTopic 3: Defense & Hardening');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [parsedPreview, setParsedPreview] = useState<ParsedCourseResult | null>(null);

  const queueCourses = state.courses
    .filter((c) => c.queue === activeQueue)
    .sort((a, b) => a.order - b.order);

  const currentCourse = queueCourses.find((c) => c.status === 'current');
  const nextCourse = queueCourses.find((c) => c.status === 'upcoming');
  const laterCourses = queueCourses.filter((c) => c.id !== currentCourse?.id && c.id !== nextCourse?.id && c.status !== 'completed');
  const completedCourses = queueCourses.filter((c) => c.status === 'completed');

  const pacing = calculatePacing(state, activeQueue, state.activeDate);

  const handleAddSimpleCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim()) return;
    const id = `${activeQueue}-${Date.now()}`;
    const nextOrder = queueCourses.length + 1;
    const newCourse: Course = {
      id,
      queue: activeQueue,
      order: nextOrder,
      title: newCourseTitle.trim(),
      status: queueCourses.some((c) => c.status === 'current') ? 'upcoming' : 'current',
      startDate: state.activeDate,
      estimatedHours: 15,
      topics: newTopicTitle.trim()
        ? [
            {
              id: `${id}-t1`,
              title: newTopicTitle.trim(),
              estimatedMinutes: 60,
              studied: false,
              recalled: false,
              recallDurationSeconds: 0,
              recallMissedPoints: [],
              rewatchCount: 0,
              items: [],
            },
          ]
        : [],
    };
    updateState((p) => ({ ...p, courses: [...p.courses, newCourse] }));
    setNewCourseTitle('');
    setNewTopicTitle('');
    setAddCourseOpen(false);
    pushToast(isAr ? 'تمت إضافة الدورة بنجاح.' : 'Course added to queue.', 'success');
  };

  const handleParseOutline = async () => {
    setBulkLoading(true);
    setBulkError(null);
    try {
      const res = await aiClient.parseCourseOutline(outlineText, activeQueue.toUpperCase(), state.language);
      setParsedPreview(res);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : t.common.offlineAi);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleConfirmBulkImport = () => {
    if (!parsedPreview) return;
    const id = `${activeQueue}-${Date.now()}`;
    const newCourse: Course = {
      id,
      queue: activeQueue,
      order: queueCourses.length + 1,
      title: parsedPreview.courseTitle || 'Imported Course',
      status: queueCourses.some((c) => c.status === 'current') ? 'upcoming' : 'current',
      startDate: state.activeDate,
      estimatedHours: Math.max(
        1,
        Math.round(parsedPreview.topics.reduce((a, tp) => a + tp.estimatedMinutes, 0) / 60)
      ),
      topics: parsedPreview.topics.map((tp, idx) => ({
        id: `${id}-t${idx + 1}`,
        title: tp.title,
        estimatedMinutes: tp.estimatedMinutes,
        studied: false,
        recalled: false,
        recallDurationSeconds: 0,
        recallMissedPoints: [],
        rewatchCount: 0,
        items: tp.items.map((it, iIdx) => ({
          id: `${id}-t${idx + 1}-i${iIdx + 1}`,
          title: it.title,
          kind: it.kind,
          estimatedMinutes: it.estimatedMinutes,
          completed: false,
        })),
      })),
    };
    updateState((p) => ({ ...p, courses: [...p.courses, newCourse] }));
    setParsedPreview(null);
    setBulkOpen(false);
    pushToast(isAr ? 'تم استيراد المنهج بنجاح.' : 'Structured course imported.', 'success');
  };

  const renderCourseRow = (course: Course, tierLabel: string) => {
    const prog = getCourseProgress(course);
    const contentProg = course.isContentPlanned
      ? getCourseContentProgress(course, state, state.activeDate)
      : null;
    const ringPercent = contentProg ? contentProg.percent : prog.percent;

    return (
      <div
        key={course.id}
        className="rounded-2xl bg-white dark:bg-[#0E131E] border border-slate-200 dark:border-white/10 p-4 flex items-center justify-between gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-cyan-600 dark:text-cyan-400">{tierLabel}</span>
            <span aria-hidden="true">·</span>
            <span>#{course.order}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{course.estimatedHours}h</span>
            {course.deadline && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">Due {course.deadline}</span>
              </>
            )}
          </div>
          <h3 className="mt-1 text-base font-semibold truncate">{course.title}</h3>
          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {contentProg
              ? `${contentProg.completedSections}/${contentProg.totalSections} ${isAr ? 'أقسام' : 'sections'} (${contentProg.percent}%) · ${course.dailyStudyHours ?? 1.5}h/day`
              : `${prog.completed}/${prog.total} topics`}
            {course.certificate?.isCertified ? ` · Cert: ${course.certificate.certificationStatus} · Voucher: ${course.certificate.voucherStatus}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ProgressRing percent={ringPercent} size={44} strokeWidth={4} />
          <button
            type="button"
            onClick={() => setSelectedCourseId(course.id)}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium hover:bg-slate-100 dark:hover:bg-white/5"
          >
            {isAr ? 'تفاصيل' : 'Open'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Queue Tabs + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
          {(['nti', 'extra', 'activity', 'language'] as QueueId[]).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setActiveQueue(q)}
              className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold uppercase transition-colors ${
                activeQueue === q
                  ? 'bg-white dark:bg-cyan-600 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="queues-plan-from-content-btn"
            onClick={() => setContentPlannerOpen(true)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium"
          >
            <FilePlus2 className="w-4 h-4" />
            {isAr ? 'تخطيط من المحتوى' : 'Plan from Content'}
          </button>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-xs font-medium"
          >
            <Sparkles className="w-4 h-4" />
            {t.library.bulkImport}
          </button>
          <button
            type="button"
            onClick={() => setAddCourseOpen(true)}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3 rounded-xl bg-cyan-600 text-white text-xs font-medium"
          >
            <Plus className="w-4 h-4" />
            {t.common.add}
          </button>
        </div>
      </div>

      {/* Pacing Summary */}
      {activeQueue === 'nti' && (
        <div className="rounded-2xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold">Professional Security Administrator — S006 · 294 hours</span>
          <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
            {t.pacing[pacing.status]} · {pacing.topicsRemaining} {t.pacing.topicsLeft} · {pacing.topicsPerDay} {t.pacing.topicsPerDay}
          </span>
        </div>
      )}

      {/* Empty State (e.g. Language Queue initially empty) */}
      {queueCourses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 p-8 text-center space-y-3">
          <Layers className="w-8 h-8 mx-auto text-slate-400" />
          <div className="text-base font-semibold">
            {activeQueue === 'language'
              ? isAr ? 'لا توجد دورة إنجليزية بعد' : 'No English course yet'
              : isAr ? 'لا توجد دورات في هذا المسار' : 'No courses in this queue'}
          </div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {isAr
              ? 'أضف دورتك أو استورد المنهج بالذكاء الاصطناعي بنفس بنية المسار → الدورة → الموضوع → العنصر.'
              : 'Add a course manually or paste an outline with Bulk Course Import.'}
          </p>
          <button
            type="button"
            onClick={() => setAddCourseOpen(true)}
            className="min-h-[44px] px-5 rounded-xl bg-cyan-600 text-white text-xs font-medium"
          >
            {activeQueue === 'language' ? (isAr ? 'إضافة دورة إنجليزية' : 'Add English Course') : isAr ? 'إضافة دورة' : 'Add Course'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {currentCourse && renderCourseRow(currentCourse, 'CURRENT')}
          {nextCourse && renderCourseRow(nextCourse, 'NEXT')}
          {laterCourses.map((c) => renderCourseRow(c, 'LATER'))}
          {completedCourses.map((c) => renderCourseRow(c, 'COMPLETED'))}
        </div>
      )}

      {/* Course Detail Bottom Sheet */}
      <BottomSheet
        open={!!selectedCourse}
        onClose={() => setSelectedCourseId(null)}
        title={selectedCourse?.title || ''}
        maxWidthClass="md:max-w-2xl"
      >
        {selectedCourse && (
          <div className="space-y-4 text-sm">
            {selectedCourse.isContentPlanned && (() => {
              const cp = getCourseContentProgress(selectedCourse, state, state.activeDate);
              return (
                <div
                  data-testid="queues-course-content-progress"
                  className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.05] p-3.5 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {isAr ? 'تقدم محتوى الدورة' : 'Course Progress'} · {cp.completedSections} / {cp.totalSections}{' '}
                      {isAr ? 'أقسام' : 'Sections'}
                    </span>
                    <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">{cp.percent}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white dark:bg-[#0E131E] p-2 border border-slate-200 dark:border-white/10">
                      <div className="text-[10px] text-slate-500">{isAr ? 'المتبقي المقدر' : 'Est. Remaining'}</div>
                      <div className="font-mono font-semibold">{cp.estimatedRemainingHours} hours</div>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-[#0E131E] p-2 border border-slate-200 dark:border-white/10">
                      <div className="text-[10px] text-slate-500">{isAr ? 'الموعد النهائي' : 'Deadline'}</div>
                      <div className="font-mono font-semibold">{cp.deadline || '—'}</div>
                    </div>
                    <div className="rounded-xl bg-white dark:bg-[#0E131E] p-2 border border-slate-200 dark:border-white/10">
                      <div className="text-[10px] text-slate-500">{isAr ? 'الحالة' : 'Status'}</div>
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">{t.pacing[cp.status]}</div>
                    </div>
                  </div>
                  {cp.isCompleted && (
                    <div className="pt-2 border-t border-emerald-500/25 flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                        <BookOpenCheck className="w-4 h-4" />
                        100% COMPLETE · {isAr ? 'ماذا تريد أن تدرس بعد ذلك؟' : 'What do you want to study next?'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCourseId(null);
                          setContentPlannerOpen(true);
                        }}
                        className="min-h-[36px] px-3 rounded-xl bg-emerald-600 text-white font-medium"
                      >
                        {isAr ? 'لصق الدورة التالية' : 'Paste Next Course Content'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {(selectedCourse.status === 'current' || selectedCourse.isContentPlanned) && (
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-white/10">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">{isAr ? 'الموعد المستهدف:' : 'Deadline:'}</span>
                    <input
                      type="date"
                      value={selectedCourse.deadline || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (selectedCourse.isContentPlanned) {
                          updateContentCourseSettings(selectedCourse.id, { deadline: val });
                        } else {
                          updateState((p) => ({
                            ...p,
                            courses: p.courses.map((c) => (c.id === selectedCourse.id ? { ...c, deadline: val } : c)),
                          }));
                        }
                      }}
                      className="min-h-[38px] px-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-xs"
                    />
                  </label>
                  {selectedCourse.isContentPlanned && (
                    <label className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">{isAr ? 'ساعات/يوم:' : 'Study h/day:'}</span>
                      <input
                        type="number"
                        min={0.25}
                        max={12}
                        step={0.25}
                        value={selectedCourse.dailyStudyHours ?? 1.5}
                        onChange={(e) => {
                          const hrs = Number(e.target.value);
                          if (!isNaN(hrs) && hrs > 0) {
                            updateContentCourseSettings(selectedCourse.id, { dailyStudyHours: hrs });
                          }
                        }}
                        className="w-16 min-h-[38px] px-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-xs"
                      />
                    </label>
                  )}
                </div>
                {selectedCourse.status === 'current' && !selectedCourse.isContentPlanned && (
                  <button
                    type="button"
                    onClick={() => {
                      promoteNextCourse(selectedCourse.id);
                      setSelectedCourseId(null);
                    }}
                    className="min-h-[38px] inline-flex items-center gap-1.5 px-3 rounded-xl bg-emerald-600 text-white text-xs font-medium"
                  >
                    {isAr ? 'إنهاء والانتقال للتالية' : 'Finish & Move to Next Course'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {selectedCourse.certificate?.isCertified && (
              <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
                <label className="block">
                  <span className="text-slate-500">Certification Status</span>
                  <select
                    value={selectedCourse.certificate.certificationStatus}
                    onChange={(e) => {
                      const val = e.target.value as NonNullable<Course['certificate']>['certificationStatus'];
                      updateState((p) => ({
                        ...p,
                        courses: p.courses.map((c) =>
                          c.id === selectedCourse.id && c.certificate
                            ? { ...c, certificate: { ...c.certificate, certificationStatus: val } }
                            : c
                        ),
                      }));
                    }}
                    className="mt-1 w-full min-h-[36px] px-2 rounded-lg bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10"
                  >
                    <option value="not_started">Not started</option>
                    <option value="preparing">Preparing</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="passed">Passed</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-slate-500">Voucher Status</span>
                  <select
                    value={selectedCourse.certificate.voucherStatus}
                    onChange={(e) => {
                      const val = e.target.value as NonNullable<Course['certificate']>['voucherStatus'];
                      updateState((p) => ({
                        ...p,
                        courses: p.courses.map((c) =>
                          c.id === selectedCourse.id && c.certificate
                            ? { ...c, certificate: { ...c.certificate, voucherStatus: val } }
                            : c
                        ),
                      }));
                    }}
                    className="mt-1 w-full min-h-[36px] px-2 rounded-lg bg-white dark:bg-[#07090F] border border-slate-200 dark:border-white/10"
                  >
                    <option value="none">None</option>
                    <option value="pending">Pending</option>
                    <option value="issued">Issued</option>
                    <option value="used">Used</option>
                  </select>
                </label>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500">
                {selectedCourse.isContentPlanned ? (isAr ? 'الفصول والأقسام' : 'Chapters & Sections') : isAr ? 'المواضيع' : 'Topics'} ({selectedCourse.topics.length})
              </div>
              {selectedCourse.topics.map((tp) => (
                <div
                  key={tp.id}
                  className="rounded-xl border border-slate-200 dark:border-white/10 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{tp.title}</div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        ~{tp.estimatedMinutes}m · {tp.studied ? 'Completed' : 'Pending'}
                        {!selectedCourse.isContentPlanned ? ` · ${tp.recalled ? 'Recalled' : 'No recall'}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => markTopicStudied(selectedCourse.id, tp.id, !tp.studied)}
                      className={`min-h-[40px] px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 shrink-0 ${
                        tp.studied ? 'bg-emerald-600 text-white' : 'border border-slate-300 dark:border-white/15'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {tp.studied ? 'Done' : 'Complete'}
                    </button>
                  </div>

                  {tp.items.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/5">
                      {tp.items.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => toggleCourseItemCompleted(selectedCourse.id, tp.id, it.id)}
                          className={`w-full min-h-[34px] px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-xs text-start transition-colors ${
                            it.completed
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2 min-w-0">
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                it.completed
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-slate-300 dark:border-white/20'
                              }`}
                            >
                              {it.completed && <Check className="w-3 h-3" />}
                            </span>
                            {sectionTypeIcon(it.sectionType)}
                            <span className={`truncate ${it.completed ? 'line-through opacity-80' : ''}`}>
                              {it.title}
                            </span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">~{it.estimatedMinutes}m</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Add Simple Course Modal */}
      <BottomSheet
        open={addCourseOpen}
        onClose={() => setAddCourseOpen(false)}
        title={isAr ? `إضافة دورة إلى ${activeQueue.toUpperCase()}` : `Add Course to ${activeQueue.toUpperCase()}`}
      >
        <form onSubmit={handleAddSimpleCourse} className="space-y-3 text-sm">
          <label className="block">
            <span className="text-xs text-slate-500">{isAr ? 'اسم الدورة' : 'Course title'}</span>
            <input
              type="text"
              required
              value={newCourseTitle}
              onChange={(e) => setNewCourseTitle(e.target.value)}
              placeholder={activeQueue === 'language' ? 'English Fluency Track' : 'Course title'}
              className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">{isAr ? 'أول موضوع (اختياري)' : 'First topic (optional)'}</span>
            <input
              type="text"
              value={newTopicTitle}
              onChange={(e) => setNewTopicTitle(e.target.value)}
              placeholder="Core Vocabulary & Listening"
              className="mt-1 w-full min-h-[44px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
            />
          </label>
          <button type="submit" className="w-full min-h-[44px] rounded-xl bg-cyan-600 text-white font-medium">
            {t.common.save}
          </button>
        </form>
      </BottomSheet>

      {/* Bulk Course Import Modal */}
      <BottomSheet
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={t.library.bulkImport}
        maxWidthClass="md:max-w-2xl"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isAr
              ? 'الصق مخطط الدورة ليحوله الذكاء الاصطناعي إلى بنية منظمة قابلة للتعديل قبل الحفظ.'
              : 'Paste a raw course outline. Gemini converts it into Queue → Course → Topic → Item for review before saving.'}
          </p>
          <textarea
            rows={6}
            value={outlineText}
            onChange={(e) => setOutlineText(e.target.value)}
            className="w-full p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono text-xs"
          />
          <button
            type="button"
            disabled={bulkLoading}
            onClick={handleParseOutline}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-cyan-600 text-white text-xs font-medium disabled:opacity-50"
          >
            <FilePlus2 className="w-4 h-4" />
            {bulkLoading ? (isAr ? 'جارٍ التحليل...' : 'Parsing outline...') : isAr ? 'تحليل بالذكاء الاصطناعي' : 'Convert Outline'}
          </button>

          {bulkError && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-700 dark:text-amber-300">
              {bulkError}
            </div>
          )}

          {parsedPreview && (
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-white/10">
              <label className="block">
                <span className="text-xs text-slate-500">{isAr ? 'عنوان الدورة (قابل للتعديل)' : 'Course Title (editable)'}</span>
                <input
                  type="text"
                  value={parsedPreview.courseTitle}
                  onChange={(e) => setParsedPreview({ ...parsedPreview, courseTitle: e.target.value })}
                  className="mt-1 w-full min-h-[40px] px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm"
                />
              </label>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {parsedPreview.topics.map((tp, idx) => (
                  <div key={idx} className="rounded-xl bg-slate-50 dark:bg-white/[0.03] p-2.5 text-xs">
                    <div className="font-semibold">{tp.title} (~{tp.estimatedMinutes}m)</div>
                    <div className="text-slate-500 mt-1">
                      {tp.items.map((it) => `${it.title} (${it.kind})`).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleConfirmBulkImport}
                className="w-full min-h-[44px] rounded-xl bg-emerald-600 text-white font-medium"
              >
                {isAr ? 'تأكيد وإضافة للمسار' : 'Confirm & Import to Queue'}
              </button>
            </div>
          )}
        </div>
      </BottomSheet>
      <ContentCoursePlannerModal
        open={contentPlannerOpen}
        onClose={() => setContentPlannerOpen(false)}
        defaultQueue={activeQueue}
      />
    </div>
  );
};
