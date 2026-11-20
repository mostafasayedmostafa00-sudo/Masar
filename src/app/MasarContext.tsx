import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createInitialState } from '../data/seed';
import {
  clearAllMasarData,
  loadMasarState,
  loadQuickPrefs,
  saveMasarState,
} from '../services/storage';
import {
  Course,
  DailyTask,
  DayMode,
  FocusSession,
  Habit,
  HabitCategory,
  Language,
  MasarState,
  QueueId,
  QuizResult,
  TaskStatus,
  ThemeMode,
  Topic,
} from '../types/masar';
import { addDays, generateDayTasks, getDayMode, replanAfterSkip } from '../utils/planner';
import {
  ParsedCourseContent,
  buildCourseFromParsedOutline,
} from '../utils/courseContentPlanner';
import { syncHabitStreaks } from '../utils/habits';

export interface ToastMessage {
  id: string;
  text: string;
  tone?: 'info' | 'success' | 'warning';
}

interface MasarContextValue {
  state: MasarState;
  isHydrated: boolean;
  toasts: ToastMessage[];
  pushToast: (text: string, tone?: ToastMessage['tone']) => void;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: ThemeMode) => void;
  setActiveDate: (date: string) => void;
  updateState: (updater: (prev: MasarState) => MasarState) => void;
  getTasksForDate: (dateStr: string) => DailyTask[];
  updateTaskStatus: (dateStr: string, taskId: string, status: TaskStatus) => void;
  updateTaskNotes: (
    dateStr: string,
    taskId: string,
    notes: Partial<Pick<DailyTask, 'notes' | 'whatILearned' | 'whatBlockedMe' | 'keyCommand' | 'keyConcept'>>
  ) => void;
  setDayOverride: (dateStr: string, mode: DayMode) => void;
  toggleHabitDate: (habitId: string, dateStr: string) => void;
  addHabit: (input: { title: string; titleAr?: string; targetDays: number; category?: HabitCategory; reminderTime?: string }) => void;
  updateHabit: (habitId: string, patch: Partial<Pick<Habit, 'title' | 'titleAr' | 'targetDays' | 'targetDaysLabel' | 'category' | 'reminderTime'>>) => void;
  deleteHabit: (habitId: string) => void;
  completeWorkoutSession: (planId: 'A' | 'B' | 'C' | 'posture' | 'mobility', durationMinutes: number, notes?: string) => void;
  markTopicStudied: (courseId: string, topicId: string, studied: boolean) => void;
  markTopicRecalled: (courseId: string, topicId: string, durationSeconds: number, missedPoints: string[]) => void;
  scheduleSpacedReview: (courseId: string, topicId: string, daysOffset?: number) => void;
  advanceCourseIfCompleted: (courseId: string) => void;
  logFocusSession: (session: Omit<FocusSession, 'id'>) => void;
  logQuizResult: (result: Omit<QuizResult, 'id'>) => void;
  logBookPages: (bookId: string, newPage: number) => void;
  resetAllData: () => Promise<void>;
  importBackupJson: (raw: string) => boolean;
  triggerHaptic: () => void;
  promptNextCourseId: string | null;
  dismissNextCoursePrompt: () => void;
  promoteNextCourse: (completedCourseId: string) => void;
  addContentPlannedCourse: (input: {
    queue: QueueId;
    parsed: ParsedCourseContent;
    deadline: string;
    dailyStudyHours: number;
    makeCurrent?: boolean;
  }) => Course;
  toggleCourseItemCompleted: (
    courseId: string,
    topicId: string,
    itemId: string,
    completed?: boolean
  ) => void;
  updateContentCourseSettings: (
    courseId: string,
    patch: { deadline?: string; dailyStudyHours?: number }
  ) => void;
  quizPromptTopic: { courseId: string; topicId: string; topicTitle: string; courseTitle: string; notes: string } | null;
  closeQuizPrompt: () => void;
}

const MasarContext = createContext<MasarContextValue | null>(null);

function syncContentTasksInState(nextState: MasarState): MasarState {
  const dateKeys = Object.keys(nextState.tasksByDate).filter((d) => d >= nextState.activeDate);
  if (dateKeys.length === 0) return nextState;

  const contentCourseIds = new Set(
    nextState.courses.filter((c) => c.isContentPlanned).map((c) => c.id)
  );
  const nextTasksByDate = { ...nextState.tasksByDate };

  for (const d of dateKeys) {
    const prevTasks = nextTasksByDate[d] || [];
    const freshTasks = generateDayTasks(nextState, d).tasks;
    const freshContentByCourse = new Map<string, DailyTask>();
    for (const ft of freshTasks) {
      if (ft.courseId && contentCourseIds.has(ft.courseId) && !ft.isCatchUp) {
        freshContentByCourse.set(ft.courseId, ft);
      }
    }

    const merged: DailyTask[] = [];
    const handledCourseIds = new Set<string>();

    for (const oldTask of prevTasks) {
      if (oldTask.courseId && contentCourseIds.has(oldTask.courseId) && !oldTask.isCatchUp) {
        if (oldTask.status === 'skipped' || oldTask.status === 'snoozed') {
          merged.push(oldTask);
          handledCourseIds.add(oldTask.courseId);
          continue;
        }
        const replacement = freshContentByCourse.get(oldTask.courseId);
        if (replacement) {
          merged.push({
            ...replacement,
            notes: oldTask.notes,
            whatILearned: oldTask.whatILearned,
            whatBlockedMe: oldTask.whatBlockedMe,
            keyCommand: oldTask.keyCommand,
            keyConcept: oldTask.keyConcept,
          });
          handledCourseIds.add(oldTask.courseId);
        }
        // If no replacement (e.g. course completed or moved to upcoming), omit stale pending task
        continue;
      }
      merged.push(oldTask);
    }

    // Add newly scheduled content-planned course tasks not previously in prevTasks
    for (const [cId, ft] of freshContentByCourse.entries()) {
      if (!handledCourseIds.has(cId)) {
        const insertAt = merged.findIndex((t) => t.category === 'posture' || t.category === 'wind_down');
        if (insertAt === -1) merged.push(ft);
        else merged.splice(insertAt, 0, ft);
      }
    }

    nextTasksByDate[d] = merged;
  }

  return {
    ...nextState,
    tasksByDate: nextTasksByDate,
  };
}

export const MasarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<MasarState>(() => {
    const prefs = loadQuickPrefs();
    const initial = createInitialState('2026-11-20');
    const urlAutostart = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autostart') === '1';
    return {
      ...initial,
      language: prefs?.language ?? initial.language,
      theme: prefs?.theme ?? initial.theme,
      onboardingCompleted: urlAutostart ? true : initial.onboardingCompleted,
    };
  });
  const [isHydrated, setIsHydrated] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [promptNextCourseId, setPromptNextCourseId] = useState<string | null>(null);
  const [quizPromptTopic, setQuizPromptTopic] = useState<{
    courseId: string;
    topicId: string;
    topicTitle: string;
    courseTitle: string;
    notes: string;
  } | null>(null);

  const pushToast = useCallback((text: string, tone: ToastMessage['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3400);
  }, []);

  const triggerHaptic = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(14);
      }
    } catch {
      // ignore
    }
  }, []);

  // Load persisted IndexedDB state on mount
  useEffect(() => {
    let mounted = true;
    loadMasarState().then((saved) => {
      if (!mounted) return;
      const urlAutostart = new URLSearchParams(window.location.search).get('autostart') === '1';
      if (saved) {
        setState({
          ...saved,
          habits: (saved.habits || []).map((h) => syncHabitStreaks(h, saved.activeDate)),
          onboardingCompleted: urlAutostart ? true : saved.onboardingCompleted,
        });
      }
      setIsHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Persist changes
  useEffect(() => {
    if (!isHydrated) return;
    saveMasarState(state);
  }, [state, isHydrated]);

  // Apply RTL/LTR and Dark/Light/System classes on <html>
  useEffect(() => {
    const html = document.documentElement;
    html.lang = state.language;
    html.dir = state.language === 'ar' ? 'rtl' : 'ltr';

    const applyTheme = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldDark = state.theme === 'dark' || (state.theme === 'system' && prefersDark);
      html.classList.toggle('dark', shouldDark);
      const themeMeta = document.querySelector('meta[name="theme-color"]');
      if (themeMeta) {
        themeMeta.setAttribute('content', shouldDark ? '#07090F' : '#F8FAFC');
      }
    };

    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [state.language, state.theme]);

  const updateState = useCallback((updater: (prev: MasarState) => MasarState) => {
    setState((prev) => updater(prev));
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setState((prev) => ({ ...prev, language: lang }));
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => {
    setState((prev) => ({ ...prev, theme }));
  }, []);

  const setActiveDate = useCallback((date: string) => {
    setState((prev) => ({
      ...prev,
      activeDate: date,
      habits: prev.habits.map((h) => syncHabitStreaks(h, date)),
    }));
  }, []);

  const getTasksForDate = useCallback(
    (dateStr: string): DailyTask[] => {
      if (state.tasksByDate[dateStr] && state.tasksByDate[dateStr].length > 0) {
        return state.tasksByDate[dateStr];
      }
      return generateDayTasks(state, dateStr).tasks;
    },
    [state]
  );

  const updateTaskStatus = useCallback(
    (dateStr: string, taskId: string, status: TaskStatus) => {
      triggerHaptic();
      setState((prev) => {
        const currentList = prev.tasksByDate[dateStr]?.length
          ? [...prev.tasksByDate[dateStr]]
          : generateDayTasks(prev, dateStr).tasks;

        const targetTask = currentList.find((t) => t.id === taskId);
        if (!targetTask) return prev;

        if (status === 'skipped') {
          const withTasks: MasarState = {
            ...prev,
            tasksByDate: { ...prev.tasksByDate, [dateStr]: currentList },
          };
          const replanned = replanAfterSkip(withTasks, dateStr, taskId);
          return replanned;
        }

        const updatedList = currentList.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status,
                actualMinutes: status === 'completed' && t.actualMinutes === 0 ? t.estimatedMinutes : t.actualMinutes,
              }
            : t
        );

        let nextCourses = prev.courses;
        let nextHabits = prev.habits;

        // Connected system intelligence: completing a study task marks topic/items studied
        if (status === 'completed' && targetTask.courseId && targetTask.topicId) {
          const course = prev.courses.find((c) => c.id === targetTask.courseId);
          if (course?.isContentPlanned && targetTask.plannedItems && targetTask.plannedItems.length > 0) {
            const plannedIds = new Set(targetTask.plannedItems.map((pi) => pi.itemId));
            nextCourses = prev.courses.map((c) => {
              if (c.id !== course.id) return c;
              const updatedTopics = c.topics.map((tp) => {
                const updatedItems = tp.items.map((it) =>
                  plannedIds.has(it.id) ? { ...it, completed: true, completedAt: dateStr } : it
                );
                const allItemsDone = updatedItems.length > 0 && updatedItems.every((it) => it.completed);
                return {
                  ...tp,
                  items: updatedItems,
                  studied: allItemsDone ? true : tp.studied,
                  completedAt: allItemsDone ? tp.completedAt || dateStr : tp.completedAt,
                };
              });
              const allCourseItemsDone = updatedTopics.every((tp) =>
                tp.items.length > 0 ? tp.items.every((it) => it.completed) : tp.studied
              );
              return {
                ...c,
                status: allCourseItemsDone ? ('completed' as const) : c.status,
                topics: updatedTopics,
              };
            });
            const updatedCourse = nextCourses.find((c) => c.id === course.id);
            if (updatedCourse && updatedCourse.status === 'completed') {
              setPromptNextCourseId(updatedCourse.id);
            }
          } else {
            const topic = course?.topics.find((tp) => tp.id === targetTask.topicId);
            if (course && topic && !topic.studied) {
              nextCourses = prev.courses.map((c) => {
                if (c.id !== course.id) return c;
                return {
                  ...c,
                  topics: c.topics.map((tp) =>
                    tp.id === topic.id
                      ? {
                          ...tp,
                          studied: true,
                          completedAt: dateStr,
                          nextReviewDate: tp.nextReviewDate || addDays(dateStr, prev.reviewOffsets[0]),
                          reviewStage: tp.reviewStage ?? 0,
                        }
                      : tp
                  ),
                };
              });
              setQuizPromptTopic({
                courseId: course.id,
                topicId: topic.id,
                topicTitle: topic.title,
                courseTitle: course.title,
                notes: topic.notes || targetTask.notes || '',
              });
              // Check if all topics in this course are now studied
              const updatedCourse = nextCourses.find((c) => c.id === course.id);
              if (updatedCourse && updatedCourse.topics.length > 0 && updatedCourse.topics.every((tp) => tp.studied)) {
                setPromptNextCourseId(updatedCourse.id);
              }
            }
          }
        }

        // Connected: completing workout automatically ticks Resistance Training habit
        if (status === 'completed' && targetTask.category === 'workout') {
          nextHabits = prev.habits.map((h) =>
            h.id === 'h-res' && !h.completedDates.includes(dateStr)
              ? syncHabitStreaks({ ...h, completedDates: [...h.completedDates, dateStr] }, dateStr)
              : h
          );
        }

        // Connected: review_later schedules spaced review (+2d)
        if (status === 'review_later' && targetTask.courseId && targetTask.topicId) {
          nextCourses = prev.courses.map((c) =>
            c.id === targetTask.courseId
              ? {
                  ...c,
                  topics: c.topics.map((tp) =>
                    tp.id === targetTask.topicId
                      ? { ...tp, nextReviewDate: addDays(dateStr, prev.reviewOffsets[0]), reviewStage: 0 }
                      : tp
                  ),
                }
              : c
          );
        }

        return {
          ...prev,
          courses: nextCourses,
          habits: nextHabits,
          tasksByDate: {
            ...prev.tasksByDate,
            [dateStr]: updatedList,
          },
        };
      });

      if (status === 'skipped') {
        pushToast(
          state.language === 'ar'
            ? 'تم التخطي وإعادة الجدولة تلقائياً ليوم التعويض.'
            : 'Skipped & automatically replanned into catch-up.',
          'warning'
        );
      } else if (status === 'completed') {
        pushToast(state.language === 'ar' ? 'تم الإتمام وتحديث التقدم.' : 'Completed · Progress synced.', 'success');
      } else if (status === 'review_later') {
        pushToast(state.language === 'ar' ? 'تمت جدولة المراجعة المتباعدة (+٢ يوم).' : 'Scheduled spaced review (+2 days).', 'info');
      }
    },
    [pushToast, state.language, triggerHaptic]
  );

  const updateTaskNotes = useCallback(
    (
      dateStr: string,
      taskId: string,
      notes: Partial<Pick<DailyTask, 'notes' | 'whatILearned' | 'whatBlockedMe' | 'keyCommand' | 'keyConcept'>>
    ) => {
      setState((prev) => {
        const list = prev.tasksByDate[dateStr]?.length
          ? [...prev.tasksByDate[dateStr]]
          : generateDayTasks(prev, dateStr).tasks;
        const target = list.find((t) => t.id === taskId);
        const updatedList = list.map((t) => (t.id === taskId ? { ...t, ...notes } : t));

        // Also mirror notes onto linked topic if present
        let nextCourses = prev.courses;
        if (target?.courseId && target?.topicId) {
          nextCourses = prev.courses.map((c) =>
            c.id === target.courseId
              ? {
                  ...c,
                  topics: c.topics.map((tp) => (tp.id === target.topicId ? { ...tp, ...notes } : tp)),
                }
              : c
          );
        }

        return {
          ...prev,
          courses: nextCourses,
          tasksByDate: { ...prev.tasksByDate, [dateStr]: updatedList },
        };
      });
    },
    []
  );

  const setDayOverride = useCallback(
    (dateStr: string, mode: DayMode) => {
      setState((prev) => {
        const nextOverrides = { ...prev.dateOverrides, [dateStr]: mode };
        const nextState: MasarState = {
          ...prev,
          dateOverrides: nextOverrides,
        };
        const prevMode = getDayMode(prev, dateStr);
        // If switching from study to travel_off, move existing screen tasks to next catch_up
        if ((prevMode === 'study' || prevMode === 'study_light') && mode === 'travel_off') {
          const oldTasks = prev.tasksByDate[dateStr] || generateDayTasks(prev, dateStr).tasks;
          let updated = { ...nextState };
          for (const t of oldTasks) {
            if (t.isScreenBased && t.status === 'pending') {
              updated = replanAfterSkip(updated, dateStr, t.id);
            }
          }
          // Regenerate travel_off tasks for dateStr and sync future content-planned dates
          updated.tasksByDate = {
            ...updated.tasksByDate,
            [dateStr]: generateDayTasks(updated, dateStr).tasks,
          };
          return syncContentTasksInState(updated);
        }
        // Otherwise regenerate date tasks cleanly and sync future content-planned dates
        return syncContentTasksInState({
          ...nextState,
          tasksByDate: {
            ...nextState.tasksByDate,
            [dateStr]: generateDayTasks(nextState, dateStr).tasks,
          },
        });
      });
      pushToast(state.language === 'ar' ? 'تم تحديث وضع اليوم وإعادة التخطيط.' : 'Day mode updated & replanned.', 'info');
    },
    [pushToast, state.language]
  );

  const toggleHabitDate = useCallback(
    (habitId: string, dateStr: string) => {
      triggerHaptic();
      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((h) => {
          if (h.id !== habitId) return h;
          const exists = h.completedDates.includes(dateStr);
          const nextDates = exists
            ? h.completedDates.filter((d) => d !== dateStr)
            : [...h.completedDates, dateStr];
          return syncHabitStreaks({ ...h, completedDates: nextDates }, prev.activeDate);
        }),
      }));
    },
    [triggerHaptic]
  );

  const addHabit = useCallback(
    (input: { title: string; titleAr?: string; targetDays: number; category?: HabitCategory; reminderTime?: string }) => {
      const cleanTitle = input.title.trim();
      if (!cleanTitle) return;
      const safeDays = Math.max(1, Math.min(365, Math.round(input.targetDays || 21)));
      const newHabit: Habit = {
        id: `h-custom-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: cleanTitle,
        titleAr: (input.titleAr || cleanTitle).trim(),
        category: input.category || 'custom',
        targetDays: safeDays,
        targetDaysLabel: `${safeDays} days`,
        completedDates: [],
        currentStreak: 0,
        bestStreak: 0,
        reminderTime: input.reminderTime?.trim() || undefined,
        isCustom: true,
      };
      triggerHaptic();
      setState((prev) => ({
        ...prev,
        habits: [...prev.habits, newHabit],
      }));
      pushToast(state.language === 'ar' ? 'تمت إضافة العادة الجديدة.' : 'Habit added.', 'success');
    },
    [pushToast, state.language, triggerHaptic]
  );

  const updateHabit = useCallback(
    (
      habitId: string,
      patch: Partial<Pick<Habit, 'title' | 'titleAr' | 'targetDays' | 'targetDaysLabel' | 'category' | 'reminderTime'>>
    ) => {
      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((h) => (h.id === habitId ? { ...h, ...patch } : h)),
      }));
      pushToast(state.language === 'ar' ? 'تم تحديث العادة.' : 'Habit updated.', 'success');
    },
    [pushToast, state.language]
  );

  const deleteHabit = useCallback(
    (habitId: string) => {
      triggerHaptic();
      setState((prev) => ({
        ...prev,
        habits: prev.habits.filter((h) => h.id !== habitId),
      }));
      pushToast(state.language === 'ar' ? 'تم حذف العادة.' : 'Habit removed.', 'info');
    },
    [pushToast, state.language, triggerHaptic]
  );

  const completeWorkoutSession = useCallback(
    (planId: 'A' | 'B' | 'C' | 'posture' | 'mobility', durationMinutes: number, notes?: string) => {
      triggerHaptic();
      setState((prev) => {
        const dateStr = prev.activeDate;
        const nextPlanMap: Record<'A' | 'B' | 'C', 'A' | 'B' | 'C'> = { A: 'B', B: 'C', C: 'A' };
        const nextPlan = planId === 'A' || planId === 'B' || planId === 'C' ? nextPlanMap[planId] : prev.nextWorkoutPlan;

        const nextHabits =
          planId === 'A' || planId === 'B' || planId === 'C'
            ? prev.habits.map((h) =>
                h.id === 'h-res' && !h.completedDates.includes(dateStr)
                  ? syncHabitStreaks({ ...h, completedDates: [...h.completedDates, dateStr] }, dateStr)
                  : h
              )
            : prev.habits;

        const currentTasks = prev.tasksByDate[dateStr] || generateDayTasks(prev, dateStr).tasks;
        const updatedTasks = currentTasks.map((t) =>
          (planId === 'posture' && t.category === 'posture') ||
          (planId !== 'posture' && t.category === 'workout')
            ? { ...t, status: 'completed' as const, actualMinutes: durationMinutes }
            : t
        );

        return {
          ...prev,
          nextWorkoutPlan: nextPlan,
          habits: nextHabits,
          tasksByDate: { ...prev.tasksByDate, [dateStr]: updatedTasks },
          workoutLogs: [
            ...prev.workoutLogs,
            {
              id: `wk-${Date.now()}`,
              date: dateStr,
              planId,
              sets: [],
              notes,
              completed: true,
              durationMinutes,
            },
          ],
        };
      });
      pushToast(
        state.language === 'ar' ? 'تم تسجيل التمرين وتحديث عادة المقاومة!' : 'Workout logged & Resistance Training synced!',
        'success'
      );
    },
    [pushToast, state.language, triggerHaptic]
  );

  const markTopicStudied = useCallback((courseId: string, topicId: string, studied: boolean) => {
    triggerHaptic();
    setState((prev) => {
      const nextCourses = prev.courses.map((c) => {
        if (c.id !== courseId) return c;
        return {
          ...c,
          topics: c.topics.map((t) =>
            t.id === topicId
              ? {
                  ...t,
                  studied,
                  completedAt: studied ? prev.activeDate : undefined,
                  nextReviewDate: studied ? t.nextReviewDate || addDays(prev.activeDate, prev.reviewOffsets[0]) : undefined,
                }
              : t
          ),
        };
      });
      const targetCourse = nextCourses.find((c) => c.id === courseId);
      const targetTopic = targetCourse?.topics.find((t) => t.id === topicId);
      if (studied && targetCourse && targetTopic) {
        setQuizPromptTopic({
          courseId,
          topicId,
          topicTitle: targetTopic.title,
          courseTitle: targetCourse.title,
          notes: targetTopic.notes || '',
        });
        if (targetCourse.topics.length > 0 && targetCourse.topics.every((t) => t.studied)) {
          setPromptNextCourseId(courseId);
        }
      }
      return { ...prev, courses: nextCourses };
    });
  }, [triggerHaptic]);

  const markTopicRecalled = useCallback(
    (courseId: string, topicId: string, durationSeconds: number, missedPoints: string[]) => {
      triggerHaptic();
      setState((prev) => ({
        ...prev,
        courses: prev.courses.map((c) =>
          c.id === courseId
            ? {
                ...c,
                topics: c.topics.map((t) =>
                  t.id === topicId
                    ? {
                        ...t,
                        recalled: true,
                        recallDurationSeconds: t.recallDurationSeconds + durationSeconds,
                        recallMissedPoints: missedPoints,
                        nextReviewDate:
                          missedPoints.length > 0
                            ? addDays(prev.activeDate, prev.reviewOffsets[0])
                            : addDays(prev.activeDate, prev.reviewOffsets[1]),
                      }
                    : t
                ),
              }
            : c
        ),
      }));
      pushToast(state.language === 'ar' ? 'تم تسجيل الاسترجاع النشط!' : 'Active recall logged!', 'success');
    },
    [pushToast, state.language, triggerHaptic]
  );

  const scheduleSpacedReview = useCallback((courseId: string, topicId: string, daysOffset?: number) => {
    setState((prev) => {
      const offset = daysOffset ?? prev.reviewOffsets[0];
      return {
        ...prev,
        courses: prev.courses.map((c) =>
          c.id === courseId
            ? {
                ...c,
                topics: c.topics.map((t) =>
                  t.id === topicId
                    ? { ...t, nextReviewDate: addDays(prev.activeDate, offset) }
                    : t
                ),
              }
            : c
        ),
      };
    });
  }, []);

  const promoteNextCourse = useCallback((completedCourseId: string) => {
    setState((prev) => {
      const doneCourse = prev.courses.find((c) => c.id === completedCourseId);
      if (!doneCourse) return prev;
      const queueCourses = prev.courses
        .filter((c) => c.queue === doneCourse.queue)
        .sort((a, b) => a.order - b.order);
      const nextUpcoming = queueCourses.find((c) => c.order > doneCourse.order && c.status !== 'completed');

      return {
        ...prev,
        courses: prev.courses.map((c) => {
          if (c.id === completedCourseId) return { ...c, status: 'completed' };
          if (nextUpcoming && c.id === nextUpcoming.id) {
            return { ...c, status: 'current', startDate: prev.activeDate };
          }
          return c;
        }),
      };
    });
    setPromptNextCourseId(null);
    pushToast(state.language === 'ar' ? 'تم الانتقال للدورة التالية!' : 'Moved to next course in queue.', 'success');
  }, [pushToast, state.language]);

  const advanceCourseIfCompleted = useCallback((courseId: string) => {
    setPromptNextCourseId(courseId);
  }, []);

  const addContentPlannedCourse = useCallback(
    (input: {
      queue: QueueId;
      parsed: ParsedCourseContent;
      deadline: string;
      dailyStudyHours: number;
      makeCurrent?: boolean;
    }): Course => {
      const makeCurrent = input.makeCurrent ?? true;
      const id = `${input.queue}-cp-${Date.now()}`;
      let createdCourse!: Course;

      setState((prev) => {
        const qCourses = prev.courses.filter((c) => c.queue === input.queue);
        createdCourse = buildCourseFromParsedOutline({
          id,
          queue: input.queue,
          order: qCourses.length + 1,
          parsed: input.parsed,
          startDate: prev.activeDate,
          deadline: input.deadline,
          dailyStudyHours: input.dailyStudyHours,
          makeCurrent,
        });

        const nextCourses = prev.courses.map((c) => {
          if (makeCurrent && c.queue === input.queue && c.status === 'current') {
            return { ...c, status: 'upcoming' as const };
          }
          return c;
        });
        nextCourses.push(createdCourse);

        return syncContentTasksInState({
          ...prev,
          courses: nextCourses,
        });
      });

      pushToast(
        state.language === 'ar'
          ? 'تم إنشاء خطة الدورة وتوزيع المحتوى على أيام الدراسة.'
          : 'Content-based course plan created & scheduled.',
        'success'
      );
      return createdCourse;
    },
    [pushToast, state.language]
  );

  const toggleCourseItemCompleted = useCallback(
    (courseId: string, topicId: string, itemId: string, forcedCompleted?: boolean) => {
      triggerHaptic();
      setState((prev) => {
        let justCompletedCourse = false;
        const nextCourses = prev.courses.map((c) => {
          if (c.id !== courseId) return c;
          const updatedTopics = c.topics.map((tp) => {
            if (tp.id !== topicId) return tp;
            const updatedItems = tp.items.map((it) => {
              if (it.id !== itemId) return it;
              const nextVal = typeof forcedCompleted === 'boolean' ? forcedCompleted : !it.completed;
              return {
                ...it,
                completed: nextVal,
                completedAt: nextVal ? prev.activeDate : undefined,
              };
            });
            const allTopicItemsDone = updatedItems.length > 0 && updatedItems.every((it) => it.completed);
            return {
              ...tp,
              items: updatedItems,
              studied: allTopicItemsDone,
              completedAt: allTopicItemsDone ? tp.completedAt || prev.activeDate : undefined,
            };
          });

          const allCourseDone =
            updatedTopics.length > 0 &&
            updatedTopics.every((tp) =>
              tp.items.length > 0 ? tp.items.every((it) => it.completed) : tp.studied
            );

          if (allCourseDone && c.status !== 'completed') {
            justCompletedCourse = true;
          }

          return {
            ...c,
            status: allCourseDone
              ? ('completed' as const)
              : c.status === 'completed'
                ? ('current' as const)
                : c.status,
            topics: updatedTopics,
          };
        });

        if (justCompletedCourse) {
          setPromptNextCourseId(courseId);
        }

        return syncContentTasksInState({
          ...prev,
          courses: nextCourses,
        });
      });
    },
    [triggerHaptic]
  );

  const updateContentCourseSettings = useCallback(
    (courseId: string, patch: { deadline?: string; dailyStudyHours?: number }) => {
      setState((prev) => {
        const nextCourses = prev.courses.map((c) =>
          c.id === courseId ? { ...c, ...patch } : c
        );
        return syncContentTasksInState({
          ...prev,
          courses: nextCourses,
        });
      });
      pushToast(
        state.language === 'ar'
          ? 'تم تحديث الموعد وساعات الدراسة وإعادة توزيع المحتوى.'
          : 'Course plan updated & redistributed.',
        'success'
      );
    },
    [pushToast, state.language]
  );

  const logFocusSession = useCallback((session: Omit<FocusSession, 'id'>) => {
    setState((prev) => ({
      ...prev,
      focusSessions: [
        ...prev.focusSessions,
        { ...session, id: `foc-${Date.now()}` },
      ],
    }));
  }, []);

  const logQuizResult = useCallback((result: Omit<QuizResult, 'id'>) => {
    setState((prev) => ({
      ...prev,
      quizResults: [...prev.quizResults, { ...result, id: `qz-${Date.now()}` }],
    }));
  }, []);

  const logBookPages = useCallback(
    (bookId: string, newPage: number) => {
      triggerHaptic();
      setState((prev) => {
        const updatedBooks = prev.books.map((b) => {
          if (b.id !== bookId) return b;
          const clamped = Math.max(0, Math.min(b.totalPages, newPage));
          const finished = clamped >= b.totalPages;
          return {
            ...b,
            currentPage: clamped,
            status: finished ? ('completed' as const) : b.status,
          };
        });
        return { ...prev, books: updatedBooks };
      });
      pushToast(state.language === 'ar' ? 'تم تحديث تقدم القراءة.' : 'Reading progress updated.', 'success');
    },
    [pushToast, state.language, triggerHaptic]
  );

  const resetAllData = useCallback(async () => {
    await clearAllMasarData();
    const fresh = createInitialState('2026-11-20');
    setState(fresh);
    pushToast(fresh.language === 'ar' ? 'تم مسح البيانات وإعادة التهيئة.' : 'All local data reset.', 'info');
  }, [pushToast]);

  const importBackupJson = useCallback(
    (raw: string): boolean => {
      try {
        const parsed = JSON.parse(raw) as MasarState;
        if (!parsed || !Array.isArray(parsed.courses) || !parsed.sleepSettings) {
          return false;
        }
        setState(parsed);
        pushToast(parsed.language === 'ar' ? 'تم استيراد النسخة الاحتياطية.' : 'Backup restored successfully.', 'success');
        return true;
      } catch {
        return false;
      }
    },
    [pushToast]
  );

  const value = useMemo<MasarContextValue>(
    () => ({
      state,
      isHydrated,
      toasts,
      pushToast,
      setLanguage,
      setTheme,
      setActiveDate,
      updateState,
      getTasksForDate,
      updateTaskStatus,
      updateTaskNotes,
      setDayOverride,
      toggleHabitDate,
      addHabit,
      updateHabit,
      deleteHabit,
      completeWorkoutSession,
      markTopicStudied,
      markTopicRecalled,
      scheduleSpacedReview,
      advanceCourseIfCompleted,
      logFocusSession,
      logQuizResult,
      logBookPages,
      resetAllData,
      importBackupJson,
      triggerHaptic,
      promptNextCourseId,
      dismissNextCoursePrompt: () => setPromptNextCourseId(null),
      promoteNextCourse,
      addContentPlannedCourse,
      toggleCourseItemCompleted,
      updateContentCourseSettings,
      quizPromptTopic,
      closeQuizPrompt: () => setQuizPromptTopic(null),
    }),
    [
      state,
      isHydrated,
      toasts,
      pushToast,
      setLanguage,
      setTheme,
      setActiveDate,
      updateState,
      getTasksForDate,
      updateTaskStatus,
      updateTaskNotes,
      setDayOverride,
      toggleHabitDate,
      addHabit,
      updateHabit,
      deleteHabit,
      completeWorkoutSession,
      markTopicStudied,
      markTopicRecalled,
      scheduleSpacedReview,
      advanceCourseIfCompleted,
      addContentPlannedCourse,
      toggleCourseItemCompleted,
      updateContentCourseSettings,
      logFocusSession,
      logQuizResult,
      logBookPages,
      resetAllData,
      importBackupJson,
      triggerHaptic,
      promptNextCourseId,
      promoteNextCourse,
      quizPromptTopic,
    ]
  );

  return <MasarContext.Provider value={value}>{children}</MasarContext.Provider>;
};

export function useMasar(): MasarContextValue {
  const ctx = useContext(MasarContext);
  if (!ctx) throw new Error('useMasar must be used inside MasarProvider');
  return ctx;
}
