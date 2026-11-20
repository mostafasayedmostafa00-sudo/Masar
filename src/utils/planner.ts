import {
  Course,
  DailyTask,
  DayMode,
  MasarState,
  PacingStatus,
  QueueId,
  SleepSettings,
  Topic,
} from '../types/masar';
import {
  allocateCourseContentForDate,
  getCourseContentProgress,
} from './courseContentPlanner';

export interface SleepSchedule {
  wakeTime: string;
  bedtime: string;
  screensOff: string;
  lastMeal: string;
  lastCoffee: string;
  morningSunlight: string;
  targetSleepHours: number;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function minutesToTime(totalMinutes: number): string {
  const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function computeSleepSchedule(settings: SleepSettings): SleepSchedule {
  const wakeMin = timeToMinutes(settings.wakeTime);
  const clampedSleep = Math.min(9, Math.max(6, settings.targetSleepHours));
  const bedMin = wakeMin - clampedSleep * 60;
  const screensOffMin = bedMin - 60;
  const lastMealMin = bedMin - 180;
  const lastCoffeeMin = bedMin - 600;
  const sunlightMin = wakeMin + 15;

  return {
    wakeTime: minutesToTime(wakeMin),
    bedtime: minutesToTime(bedMin),
    screensOff: minutesToTime(screensOffMin),
    lastMeal: minutesToTime(lastMealMin),
    lastCoffee: minutesToTime(lastCoffeeMin),
    morningSunlight: minutesToTime(sunlightMin),
    targetSleepHours: clampedSleep,
  };
}

export function getDayMode(state: MasarState, dateStr: string): DayMode {
  if (state.dateOverrides[dateStr]) {
    return state.dateOverrides[dateStr];
  }
  const dow = getDayOfWeek(dateStr);
  return state.weeklyTemplate[dow] ?? 'study';
}

/** Returns Saturday -> Friday 7-day range containing `dateStr`. */
export function getWeekDates(dateStr: string): string[] {
  const dow = getDayOfWeek(dateStr); // 0=Sun..6=Sat
  // Distance back to Saturday (6): Sat->0, Sun->1, Mon->2, Tue->3, Wed->4, Thu->5, Fri->6
  const offsetFromSat = (dow + 1) % 7;
  const sat = addDays(dateStr, -offsetFromSat);
  return Array.from({ length: 7 }, (_, i) => addDays(sat, i));
}

export function getCurrentCourse(courses: Course[], queue: QueueId): Course | undefined {
  return courses
    .filter((c) => c.queue === queue)
    .sort((a, b) => a.order - b.order)
    .find((c) => c.status === 'current');
}

export function getNextPendingTopic(course?: Course): Topic | undefined {
  if (!course) return undefined;
  return course.topics.find((t) => !t.studied || !t.recalled);
}

export function isCourseCompleted(course: Course): boolean {
  if (course.topics.length === 0) return false;
  return course.topics.every((t) => t.studied);
}

export function getCourseProgress(course: Course): { completed: number; total: number; percent: number } {
  const total = course.topics.length;
  if (total === 0) return { completed: 0, total: 0, percent: 0 };
  const completed = course.topics.filter((t) => t.studied).length;
  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
  };
}

/**
 * Generates tasks for a given date while strictly enforcing the Sleep Guard Hard Planner Rule:
 * Screen-based evening learning blocks never exceed `screensOff`.
 * Excess blocks are trimmed in reverse priority order.
 */
export function generateDayTasks(state: MasarState, dateStr: string): {
  tasks: DailyTask[];
  overflowQueues: QueueId[];
} {
  const mode = getDayMode(state, dateStr);
  const sleep = computeSleepSchedule(state.sleepSettings);
  const screensOffMin = timeToMinutes(sleep.screensOff);
  const eveningStartMin = timeToMinutes(state.sleepSettings.eveningStartTime);
  // Handle wrap-around if screensOff is e.g. 22:30 (1350) vs eveningStart 17:30 (1050)
  const effectiveScreensOff = screensOffMin <= eveningStartMin ? screensOffMin + 1440 : screensOffMin;
  const availableEveningWindow = Math.max(0, effectiveScreensOff - eveningStartMin);

  const tasks: DailyTask[] = [];
  const overflowQueues: QueueId[] = [];

  // 1. Morning Workout or Mobility (screenless)
  if (mode === 'travel_off') {
    tasks.push({
      id: `${dateStr}-mobility`,
      date: dateStr,
      category: 'workout',
      title: '10-Minute Travel Mobility',
      subtitle: 'Light joints & spine decompression',
      scheduledTime: '06:45',
      estimatedMinutes: 10,
      actualMinutes: 0,
      status: 'pending',
      priority: 1,
      isScreenBased: false,
    });
  } else {
    tasks.push({
      id: `${dateStr}-workout`,
      date: dateStr,
      category: 'workout',
      title: `Workout ${state.nextWorkoutPlan}`,
      subtitle: '40m home bodyweight resistance session',
      scheduledTime: '06:35',
      estimatedMinutes: 40,
      actualMinutes: 0,
      status: 'pending',
      priority: 1,
      isScreenBased: false,
    });
  }

  // 2. Commute suggestion (Books / Podcasts)
  const currentBook = state.books.find((b) => b.status === 'current');
  const nextPodcast = state.podcasts.find((p) => !p.completed);
  if (currentBook || nextPodcast) {
    tasks.push({
      id: `${dateStr}-reading`,
      date: dateStr,
      category: 'reading',
      title: currentBook
        ? `Read: ${currentBook.title} (${currentBook.dailyTargetPages} pages)`
        : `Podcast: ${nextPodcast!.title}`,
      subtitle: 'Commute / screenless wind-down',
      scheduledTime: '07:30',
      estimatedMinutes: 25,
      actualMinutes: 0,
      status: 'pending',
      priority: 3,
      isScreenBased: false,
    });
  }

  // 3. Catch-up recovery on Thursday (or catch_up mode)
  if (mode === 'catch_up') {
    const weekDates = getWeekDates(dateStr);
    const earlierDates = weekDates.filter((d) => d < dateStr);
    const recoverable: DailyTask[] = [];

    for (const d of earlierDates) {
      const prevTasks = state.tasksByDate[d] || [];
      for (const t of prevTasks) {
        if ((t.status === 'skipped' || t.status === 'snoozed') && t.isScreenBased) {
          recoverable.push({
            ...t,
            id: `${dateStr}-catchup-${t.id}`,
            date: dateStr,
            status: 'pending',
            isCatchUp: true,
          });
        }
      }
    }

    let cursorMin = eveningStartMin;
    for (const rTask of recoverable) {
      if (cursorMin + rTask.estimatedMinutes <= effectiveScreensOff) {
        tasks.push({
          ...rTask,
          scheduledTime: minutesToTime(cursorMin),
        });
        cursorMin += rTask.estimatedMinutes + state.blockDurations.breakMinutes;
      }
    }

    // Add Weekly Review task
    if (cursorMin + 30 <= effectiveScreensOff) {
      tasks.push({
        id: `${dateStr}-weekly-review`,
        date: dateStr,
        category: 'review',
        title: 'Weekly Review & Next-Week Plan',
        subtitle: 'Audit completed/skipped topics, sleep, habits & AI review',
        scheduledTime: minutesToTime(cursorMin),
        estimatedMinutes: 30,
        actualMinutes: 0,
        status: 'pending',
        priority: 1,
        isScreenBased: true,
      });
    }
  } else if (mode === 'study' || mode === 'study_light') {
    // 4. Spaced Reviews due on or before dateStr
    const dueReviews: { course: Course; topic: Topic }[] = [];
    for (const course of state.courses) {
      for (const topic of course.topics) {
        if (topic.nextReviewDate && topic.nextReviewDate <= dateStr) {
          dueReviews.push({ course, topic });
        }
      }
    }

    // Candidate screen-based study blocks ordered by priorityOrder
    const maxBlocks = mode === 'study_light' ? 2 : 4;
    const candidates: Array<{
      queue: QueueId;
      course?: Course;
      topic?: Topic;
      minutes: number;
      priorityIdx: number;
      title: string;
      subtitle: string;
      plannedItems?: DailyTask['plannedItems'];
      allCompletedToday?: boolean;
    }> = [];

    state.priorityOrder.forEach((queue, idx) => {
      const course = getCurrentCourse(state.courses, queue);
      const duration = state.blockDurations[queue];

      if (course && course.isContentPlanned) {
        const allocation = allocateCourseContentForDate(state, course, dateStr);
        if (allocation.pendingItems.length > 0 || allocation.completedTodayItems.length > 0) {
          const firstTopicId =
            allocation.pendingItems[0]?.topicId ||
            allocation.completedTodayItems[0]?.topicId ||
            course.topics[0]?.id;
          const totalCount = allocation.pendingItems.length + allocation.completedTodayItems.length;
          const remainingCount = allocation.pendingItems.length;
          const uniqueChapters = Array.from(
            new Set(allocation.allDisplayItems.map((i) => i.topicTitle))
          );
          const chapterLabel =
            uniqueChapters.length === 1
              ? uniqueChapters[0]
              : `${uniqueChapters[0]} → ${uniqueChapters[uniqueChapters.length - 1]}`;
          const blockMinutes = Math.max(
            15,
            allocation.remainingMinutesToday || allocation.totalEstimatedMinutes || duration
          );

          if (firstTopicId) {
            candidates.push({
              queue,
              course,
              topic: course.topics.find((tp) => tp.id === firstTopicId) || course.topics[0],
              minutes: blockMinutes,
              priorityIdx: idx + 1,
              title: `${course.title} — ${chapterLabel}`,
              subtitle:
                remainingCount > 0
                  ? `${queue.toUpperCase()} · ${remainingCount}/${totalCount} sections remaining today (~${blockMinutes}m)`
                  : `${queue.toUpperCase()} · ${totalCount} sections completed today`,
              plannedItems: allocation.pendingItems,
              allCompletedToday: remainingCount === 0 && allocation.completedTodayItems.length > 0,
            });
          }
        }
        return;
      }

      const topic = getNextPendingTopic(course);
      if (course && topic) {
        candidates.push({
          queue,
          course,
          topic,
          minutes: topic.estimatedMinutes || duration,
          priorityIdx: idx + 1,
          title: `${course.title} — ${topic.title}`,
          subtitle: `${queue.toUpperCase()} · Topic completion target (~${topic.estimatedMinutes || duration}m)`,
        });
      }
    });

    const selectedCandidates = candidates.slice(0, maxBlocks);
    let cursorMin = eveningStartMin;
    let usedWindow = 0;

    // Schedule due spaced review first if space permits
    for (const rev of dueReviews.slice(0, 2)) {
      const revDur = 15;
      if (usedWindow + revDur <= availableEveningWindow) {
        tasks.push({
          id: `${dateStr}-rev-${rev.topic.id}`,
          date: dateStr,
          category: 'review',
          title: `Spaced Review: ${rev.topic.title}`,
          subtitle: `${rev.course.title} · 10–15m active recall check`,
          courseId: rev.course.id,
          topicId: rev.topic.id,
          scheduledTime: minutesToTime(cursorMin),
          estimatedMinutes: revDur,
          actualMinutes: 0,
          status: 'pending',
          priority: 1,
          isScreenBased: true,
        });
        cursorMin += revDur + 10;
        usedWindow += revDur + 10;
      }
    }

    for (const cand of selectedCandidates) {
      const blockDur = cand.minutes;
      if (cand.allCompletedToday || usedWindow + blockDur <= availableEveningWindow) {
        tasks.push({
          id: `${dateStr}-${cand.queue}-${cand.topic!.id}`,
          date: dateStr,
          category: cand.queue,
          title: cand.title,
          subtitle: cand.subtitle,
          courseId: cand.course!.id,
          topicId: cand.topic!.id,
          plannedItems: cand.plannedItems,
          scheduledTime: minutesToTime(cursorMin),
          estimatedMinutes: blockDur,
          actualMinutes: cand.allCompletedToday ? blockDur : 0,
          status: cand.allCompletedToday ? 'completed' : 'pending',
          priority: cand.priorityIdx,
          isScreenBased: true,
        });
        if (!cand.allCompletedToday) {
          cursorMin += blockDur + state.blockDurations.breakMinutes;
          usedWindow += blockDur + state.blockDurations.breakMinutes;
        }
      } else {
        // Hard Planner Rule: do not sacrifice sleep! Trim lower priority queue
        overflowQueues.push(cand.queue);
      }
    }
  }

  // 5. Evening Posture Break (screenless, ~10m)
  tasks.push({
    id: `${dateStr}-posture`,
    date: dateStr,
    category: 'posture',
    title: 'Evening Posture Reset (10m)',
    subtitle: 'Wall angels, chin tucks, doorway stretch, cat-cow',
    scheduledTime: minutesToTime(effectiveScreensOff - 20),
    estimatedMinutes: 10,
    actualMinutes: 0,
    status: 'pending',
    priority: 2,
    isScreenBased: false,
  });

  // 6. Speaking Challenge (can be done screenless / minimal interaction)
  const nextSpeaking = state.speakingDays.find((d) => !d.completed);
  if (nextSpeaking) {
    tasks.push({
      id: `${dateStr}-speaking`,
      date: dateStr,
      category: 'speaking',
      title: `Speaking Day ${nextSpeaking.day}: ${nextSpeaking.topic}`,
      subtitle: nextSpeaking.instructions,
      scheduledTime: sleep.screensOff,
      estimatedMinutes: 10,
      actualMinutes: 0,
      status: 'pending',
      priority: 3,
      isScreenBased: false,
    });
  }

  // 7. Wind-down routine (after screens-off)
  tasks.push({
    id: `${dateStr}-winddown`,
    date: dateStr,
    category: 'wind_down',
    title: 'Screenless Wind-Down',
    subtitle: 'Paper book, Hooponopono, bedtime prep before ' + sleep.bedtime,
    scheduledTime: sleep.screensOff,
    estimatedMinutes: 45,
    actualMinutes: 0,
    status: 'pending',
    priority: 1,
    isScreenBased: false,
  });

  return { tasks, overflowQueues };
}

/** Automatically replans when a task is skipped or a day mode switches to travel_off. */
export function replanAfterSkip(state: MasarState, dateStr: string, skippedTaskId: string): MasarState {
  const dayTasks = [...(state.tasksByDate[dateStr] || [])];
  const idx = dayTasks.findIndex((t) => t.id === skippedTaskId);
  if (idx === -1) return state;

  const skipped = { ...dayTasks[idx], status: 'skipped' as const };
  dayTasks[idx] = skipped;

  const nextTasksByDate = { ...state.tasksByDate, [dateStr]: dayTasks };
  const sleep = computeSleepSchedule(state.sleepSettings);

  // Prefer the next Catch-up day within 7 days, or fall back to next Study day
  let chosenTarget: string | null = null;
  let fallbackStudy: string | null = null;

  for (let offset = 1; offset <= 7; offset++) {
    const targetDate = addDays(dateStr, offset);
    const targetMode = getDayMode(state, targetDate);
    if (targetMode === 'catch_up' && !chosenTarget) {
      chosenTarget = targetDate;
      break;
    }
    if ((targetMode === 'study' || targetMode === 'study_light') && !fallbackStudy) {
      fallbackStudy = targetDate;
    }
  }

  const targetDate = chosenTarget || fallbackStudy;
  if (targetDate && skipped.isScreenBased) {
    const existing = nextTasksByDate[targetDate]
      ? [...nextTasksByDate[targetDate]]
      : generateDayTasks(state, targetDate).tasks;
    const matchIdx = existing.findIndex((t) => t.topicId && t.topicId === skipped.topicId);
    if (matchIdx !== -1) {
      existing[matchIdx] = {
        ...existing[matchIdx],
        isCatchUp: true,
        subtitle: `Recovered from ${dateStr} · Before ${sleep.screensOff}`,
      };
    } else {
      existing.unshift({
        ...skipped,
        id: `${targetDate}-replan-${skipped.id}`,
        date: targetDate,
        status: 'pending',
        isCatchUp: true,
        scheduledTime: state.sleepSettings.eveningStartTime,
        subtitle: `Recovered from ${dateStr} · Before ${sleep.screensOff}`,
      });
    }
    nextTasksByDate[targetDate] = existing;
  }

  return {
    ...state,
    tasksByDate: nextTasksByDate,
  };
}

export function calculatePacing(state: MasarState, queue: QueueId, referenceDateStr: string): {
  topicsRemaining: number;
  topicsCompleted: number;
  availableStudyDays: number;
  topicsPerDay: number;
  completionRate: number;
  status: PacingStatus;
  estimatedCompletionDate: string | null;
} {
  const course = getCurrentCourse(state.courses, queue);
  if (!course) {
    return {
      topicsRemaining: 0,
      topicsCompleted: 0,
      availableStudyDays: 0,
      topicsPerDay: 0,
      completionRate: 0,
      status: 'on_track',
      estimatedCompletionDate: null,
    };
  }

  if (course.isContentPlanned) {
    const prog = getCourseContentProgress(course, state, referenceDateStr);
    const topicsPerDay =
      prog.availableStudyDays > 0
        ? Number((prog.remainingSections / prog.availableStudyDays).toFixed(2))
        : prog.remainingSections;
    return {
      topicsRemaining: prog.remainingSections,
      topicsCompleted: prog.completedSections,
      availableStudyDays: prog.availableStudyDays,
      topicsPerDay,
      completionRate: prog.percent,
      status: prog.status,
      estimatedCompletionDate: prog.estimatedCompletionDate,
    };
  }

  const total = course.topics.length;
  const completed = course.topics.filter((t) => t.studied).length;
  const remaining = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const deadline = course.deadline || addDays(referenceDateStr, 14);
  let availableStudyDays = 0;
  let cursor = referenceDateStr;
  for (let i = 0; i < 90 && cursor <= deadline; i++) {
    const mode = getDayMode(state, cursor);
    if (mode === 'study' || mode === 'study_light' || mode === 'catch_up') {
      availableStudyDays++;
    }
    cursor = addDays(cursor, 1);
  }

  const topicsPerDay = availableStudyDays > 0 ? Number((remaining / availableStudyDays).toFixed(2)) : remaining;
  let status: PacingStatus = 'on_track';
  if (remaining === 0 && total > 0) status = 'ahead';
  else if (topicsPerDay > 1.35 || (availableStudyDays === 0 && remaining > 0)) status = 'behind';
  else if (topicsPerDay <= 0.65) status = 'ahead';

  // Estimate completion date by walking forward study days
  let estDate: string | null = null;
  if (remaining > 0) {
    let neededDays = Math.ceil(remaining);
    let walk = referenceDateStr;
    for (let i = 0; i < 120; i++) {
      const m = getDayMode(state, walk);
      if (m === 'study' || m === 'study_light' || m === 'catch_up') {
        neededDays--;
        if (neededDays <= 0) {
          estDate = walk;
          break;
        }
      }
      walk = addDays(walk, 1);
    }
  } else {
    estDate = referenceDateStr;
  }

  return {
    topicsRemaining: remaining,
    topicsCompleted: completed,
    availableStudyDays,
    topicsPerDay,
    completionRate,
    status,
    estimatedCompletionDate: estDate,
  };
}

export interface CrossIntelligenceAlert {
  id: string;
  severity: 'info' | 'warning';
  message: string;
  messageAr: string;
}

export function getCrossFeatureInsights(state: MasarState, dateStr: string): CrossIntelligenceAlert[] {
  const alerts: CrossIntelligenceAlert[] = [];

  // 1. Sleep adherence check
  const prevDate = addDays(dateStr, -1);
  const prevSleep = state.sleepLogs[prevDate];
  if (prevSleep?.hoursSlept !== undefined && prevSleep.hoursSlept < state.sleepSettings.targetSleepHours - 0.5) {
    alerts.push({
      id: 'ci-sleep',
      severity: 'warning',
      message: 'Your sleep was below target. Consider reducing today’s optional workload.',
      messageAr: 'كان نومك أقل من الهدف. يُفضّل تخفيف المهام الاختيارية اليوم.',
    });
  }

  // 2. NTI pacing check
  const ntiPacing = calculatePacing(state, 'nti', dateStr);
  if (ntiPacing.status === 'behind') {
    alerts.push({
      id: 'ci-nti-behind',
      severity: 'warning',
      message: 'NTI is currently behind schedule. Extra workload may be reduced to protect your core track.',
      messageAr: 'مسار NTI متأخر عن الجدول. يمكنك تقليص المهام الإضافية لحماية المسار الأساسي.',
    });
  }

  // 3. Illusion of Mastery Guard
  const passiveTopics = state.courses
    .flatMap((c) => c.topics)
    .filter((t) => (t.studied && !t.recalled) || t.rewatchCount >= 2);
  if (passiveTopics.length >= 2) {
    alerts.push({
      id: 'ci-mastery',
      severity: 'info',
      message: `Illusion of Mastery Guard: ${passiveTopics.length} topics were studied without active recall yet.`,
      messageAr: `حارس وهم الإتقان: هناك ${passiveTopics.length} مواضيع تمت دراستها دون استرجاع نشط بعد.`,
    });
  }

  // 4. Missed workout adaptation
  const dayTasks = state.tasksByDate[dateStr] || [];
  const skippedWorkout = dayTasks.some((t) => t.category === 'workout' && t.status === 'skipped');
  if (skippedWorkout) {
    alerts.push({
      id: 'ci-workout',
      severity: 'info',
      message: 'Workout skipped today — shifted automatically to your next available morning slot.',
      messageAr: 'تم تخطي تمرين اليوم — نُقل تلقائياً لأقرب موعد صباحي متاح.',
    });
  }

  return alerts;
}
