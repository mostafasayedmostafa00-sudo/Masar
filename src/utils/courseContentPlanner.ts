import {
  Course,
  DayMode,
  ItemKind,
  LearningItem,
  MasarState,
  PacingStatus,
  PlannedContentItem,
  QueueId,
  SectionContentType,
  Topic,
} from '../types/masar';

export interface ParsedSectionDraft {
  title: string;
  kind: ItemKind;
  sectionType: SectionContentType;
  estimatedMinutes: number;
}

export interface ParsedChapterDraft {
  title: string;
  estimatedMinutes: number;
  items: ParsedSectionDraft[];
}

export interface ParsedCourseContent {
  courseTitle: string;
  chapters: ParsedChapterDraft[];
  totalSections: number;
  totalMinutes: number;
  countsByType: Record<SectionContentType, number>;
}

export interface ContentDayEntry {
  topicId: string;
  topicTitle: string;
  itemId: string;
  itemTitle: string;
  sectionType: SectionContentType;
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
}

export interface CourseContentDayAllocation {
  date: string;
  isStudyDay: boolean;
  dayMode: DayMode;
  completedTodayItems: ContentDayEntry[];
  pendingItems: PlannedContentItem[];
  allDisplayItems: ContentDayEntry[];
  totalEstimatedMinutes: number;
  remainingMinutesToday: number;
  completedTodayMinutes: number;
}

export interface CourseContentProgress {
  completedSections: number;
  totalSections: number;
  remainingSections: number;
  percent: number;
  totalMinutes: number;
  completedMinutes: number;
  remainingMinutes: number;
  estimatedRemainingHours: number;
  availableStudyDays: number;
  dailyBudgetMinutes: number;
  requiredMinutesPerDay: number;
  deadline: string | null;
  status: PacingStatus;
  estimatedCompletionDate: string | null;
  isCompleted: boolean;
}

function addDaysLocal(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function getDayOfWeekLocal(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function getDayModeLocal(state: MasarState, dateStr: string): DayMode {
  if (state.dateOverrides[dateStr]) {
    return state.dateOverrides[dateStr];
  }
  const dow = getDayOfWeekLocal(dateStr);
  return state.weeklyTemplate[dow] ?? 'study';
}

function isStudyDayForQueue(state: MasarState, dateStr: string, queue: QueueId): boolean {
  const mode = getDayModeLocal(state, dateStr);
  if (mode !== 'study' && mode !== 'study_light') return false;
  const maxBlocks = mode === 'study_light' ? 2 : 4;
  const qIdx = state.priorityOrder.indexOf(queue);
  return qIdx === -1 || qIdx < maxBlocks;
}

export function classifySectionItem(rawTitle: string): ParsedSectionDraft {
  const title = rawTitle.trim();
  const lower = title.toLowerCase();

  if (/\bquiz\b/i.test(lower) || /:\s*quiz\b/i.test(lower)) {
    return { title, kind: 'practice', sectionType: 'quiz', estimatedMinutes: 15 };
  }
  if (/\bguided\s+exercise\b/i.test(lower)) {
    return { title, kind: 'lab', sectionType: 'guided_exercise', estimatedMinutes: 25 };
  }
  if (/\blab\b/i.test(lower) || /:\s*lab\b/i.test(lower)) {
    return { title, kind: 'lab', sectionType: 'lab', estimatedMinutes: 35 };
  }
  if (/\bexercise\b/i.test(lower) || /:\s*exercise\b/i.test(lower)) {
    return { title, kind: 'lab', sectionType: 'guided_exercise', estimatedMinutes: 25 };
  }
  if (/\bsummary\b/i.test(lower)) {
    return { title, kind: 'reading', sectionType: 'summary', estimatedMinutes: 10 };
  }
  if (/\breview\b/i.test(lower)) {
    return { title, kind: 'practice', sectionType: 'review', estimatedMinutes: 20 };
  }
  return { title, kind: 'reading', sectionType: 'section', estimatedMinutes: 20 };
}

function cleanBulletPrefix(line: string): string {
  return line
    .replace(/^#+\s+/, '')
    .replace(/^[-*•]\s+/, '')
    .replace(/^\[[ xX]?\]\s+/, '')
    .trim();
}

export function parseCourseOutlineContent(
  rawText: string,
  explicitCourseTitle?: string
): ParsedCourseContent {
  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^\.{3,}$/.test(l) && !/^[-_=]{3,}$/.test(l));

  let inferredTitle = explicitCourseTitle?.trim() || '';
  const chapters: ParsedChapterDraft[] = [];
  let currentChapter: ParsedChapterDraft | null = null;

  const ensureChapter = (title: string): ParsedChapterDraft => {
    const existing = chapters.find((ch) => ch.title === title);
    if (existing) return existing;
    const created: ParsedChapterDraft = { title, estimatedMinutes: 0, items: [] };
    chapters.push(created);
    return created;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = cleanBulletPrefix(rawLines[i]);
    if (!line) continue;

    // Explicit "Course: Name" header
    const explicitCourseMatch = line.match(/^(?:course(?:\s+title|\s+name)?)\s*[:\-–]\s*(.+)$/i);
    if (explicitCourseMatch && chapters.length === 0) {
      if (!inferredTitle) {
        inferredTitle = explicitCourseMatch[1].trim();
      }
      continue;
    }

    // Chapter / Module / Unit / Part / Appendix / Week header
    const chapterMatch = line.match(
      /^(?:chapter|module|unit|part|appendix|week|ch\.?)\s+[a-z0-9]+(?:\s*[:\-–.]\s*.*)?$/i
    );
    if (chapterMatch) {
      currentChapter = ensureChapter(line);
      continue;
    }

    // Explicit Section X.Y: Title
    const letterSectionMatch = line.match(/^section\s+([a-z]+)\.\d+(?:\s*[:\-–.]\s*(.+))?$/i);
    if (letterSectionMatch) {
      const groupLetter = letterSectionMatch[1].toUpperCase();
      const subtitle = letterSectionMatch[2]?.trim();
      if (!inferredTitle && i === 0 && subtitle && !/orientation|classroom|lab\s+exercise|summary/i.test(subtitle)) {
        inferredTitle = subtitle;
      }
      if (!currentChapter || !currentChapter.title.startsWith(`Section ${groupLetter}`)) {
        currentChapter = ensureChapter(`Section ${groupLetter}: Orientation & Overview`);
      }
      currentChapter.items.push(classifySectionItem(line));
      continue;
    }

    const numericSectionMatch = line.match(/^(?:section\s+)?(\d+)\.(\d+)(?:\s*[:\-–.]\s*(.+))?$/i);
    if (numericSectionMatch) {
      const majorNum = numericSectionMatch[1];
      if (!currentChapter) {
        currentChapter = ensureChapter(`Chapter ${majorNum}`);
      }
      currentChapter.items.push(classifySectionItem(line));
      continue;
    }

    // Lesson / Topic / Lab / Quiz / Exercise / Summary lines
    const namedItemMatch = line.match(
      /^(?:section|lesson|topic|quiz|guided\s+exercise|exercise|lab|summary|review)\b/i
    );
    if (namedItemMatch) {
      if (!currentChapter) {
        currentChapter = ensureChapter('Module 1: Core Content');
      }
      currentChapter.items.push(classifySectionItem(line));
      continue;
    }

    // Standalone top line before any chapter/section -> course title
    if (i === 0 && !inferredTitle && rawLines.length > 1) {
      inferredTitle = line;
      continue;
    }

    // Fallback plain item inside current or default chapter
    if (!currentChapter) {
      currentChapter = ensureChapter('Chapter 1');
    }
    currentChapter.items.push(classifySectionItem(line));
  }

  // Ensure every chapter has at least one actionable item
  for (const ch of chapters) {
    if (ch.items.length === 0) {
      ch.items.push(classifySectionItem(ch.title));
    }
    ch.estimatedMinutes = ch.items.reduce((sum, it) => sum + it.estimatedMinutes, 0);
  }

  const countsByType: Record<SectionContentType, number> = {
    section: 0,
    quiz: 0,
    guided_exercise: 0,
    lab: 0,
    summary: 0,
    review: 0,
  };

  let totalSections = 0;
  let totalMinutes = 0;
  for (const ch of chapters) {
    for (const it of ch.items) {
      totalSections++;
      totalMinutes += it.estimatedMinutes;
      countsByType[it.sectionType] = (countsByType[it.sectionType] || 0) + 1;
    }
  }

  const fallbackTitle =
    inferredTitle ||
    chapters[0]?.title.replace(/^(?:chapter|module|unit)\s+[a-z0-9]+\s*[:\-–.]\s*/i, '').trim() ||
    'Planned Course';

  return {
    courseTitle: fallbackTitle,
    chapters,
    totalSections,
    totalMinutes,
    countsByType,
  };
}

export function buildCourseFromParsedOutline(input: {
  id: string;
  queue: QueueId;
  order: number;
  parsed: ParsedCourseContent;
  startDate: string;
  deadline: string;
  dailyStudyHours: number;
  makeCurrent: boolean;
}): Course {
  const { id, queue, order, parsed, startDate, deadline, dailyStudyHours, makeCurrent } = input;
  const topics: Topic[] = parsed.chapters.map((ch, chIdx) => {
    const topicId = `${id}-ch${chIdx + 1}`;
    const items: LearningItem[] = ch.items.map((it, itIdx) => ({
      id: `${topicId}-s${itIdx + 1}`,
      title: it.title,
      kind: it.kind,
      sectionType: it.sectionType,
      estimatedMinutes: it.estimatedMinutes,
      completed: false,
    }));
    return {
      id: topicId,
      title: ch.title,
      estimatedMinutes: ch.estimatedMinutes,
      studied: false,
      recalled: false,
      recallDurationSeconds: 0,
      recallMissedPoints: [],
      rewatchCount: 0,
      items,
    };
  });

  return {
    id,
    queue,
    order,
    title: parsed.courseTitle,
    status: makeCurrent ? 'current' : 'upcoming',
    startDate,
    deadline,
    dailyStudyHours: Math.max(0.25, Math.min(12, Number(dailyStudyHours) || 1.5)),
    isContentPlanned: true,
    estimatedHours: Math.max(1, Math.round((parsed.totalMinutes / 60) * 10) / 10),
    topics,
  };
}

interface FlatCourseItem {
  topicId: string;
  topicTitle: string;
  item: LearningItem;
}

function flattenCourseItems(course: Course): FlatCourseItem[] {
  const list: FlatCourseItem[] = [];
  for (const tp of course.topics) {
    if (tp.items.length > 0) {
      for (const it of tp.items) {
        list.push({ topicId: tp.id, topicTitle: tp.title, item: it });
      }
    } else {
      list.push({
        topicId: tp.id,
        topicTitle: tp.title,
        item: {
          id: `${tp.id}-main`,
          title: tp.title,
          kind: 'reading',
          sectionType: 'section',
          estimatedMinutes: tp.estimatedMinutes || 30,
          completed: tp.studied,
          completedAt: tp.completedAt,
        },
      });
    }
  }
  return list;
}

function collectAvailableStudyDays(
  state: MasarState,
  startDate: string,
  endDate: string,
  queue: QueueId,
  maxLookahead = 365
): string[] {
  const days: string[] = [];
  let cursor = startDate;
  for (let i = 0; i < maxLookahead && cursor <= endDate; i++) {
    if (isStudyDayForQueue(state, cursor, queue)) {
      days.push(cursor);
    }
    cursor = addDaysLocal(cursor, 1);
  }
  return days;
}

function pickItemsForDaySlice(
  pool: FlatCourseItem[],
  startIndex: number,
  dailyBudgetMin: number,
  remainingStudyDays: number,
  alreadyDoneMinutesToday = 0
): { endIndex: number; pickedMinutes: number } {
  if (startIndex >= pool.length) {
    return { endIndex: startIndex, pickedMinutes: 0 };
  }

  const remainingItemsCount = pool.length - startIndex;
  let remainingTotalMin = 0;
  for (let i = startIndex; i < pool.length; i++) {
    remainingTotalMin += pool[i].item.estimatedMinutes || 20;
  }

  const safeDays = Math.max(1, remainingStudyDays);
  const requiredMinPerDay = remainingTotalMin / safeDays;
  const targetTotalForDay = Math.max(dailyBudgetMin, requiredMinPerDay);

  if (alreadyDoneMinutesToday >= targetTotalForDay * 0.85 && requiredMinPerDay <= dailyBudgetMin) {
    // User already met Today's planned effort; move remaining sections forward to next study day
    return { endIndex: startIndex, pickedMinutes: 0 };
  }

  const effectiveTargetMin = Math.max(0, targetTotalForDay - alreadyDoneMinutesToday);
  const needsAcceleration = requiredMinPerDay > dailyBudgetMin;
  const minItemsForPace = needsAcceleration ? Math.max(1, Math.ceil(remainingItemsCount / safeDays)) : 1;

  let accMin = 0;
  let cursor = startIndex;

  while (cursor < pool.length) {
    const nextMin = pool[cursor].item.estimatedMinutes || 20;
    const countSoFar = cursor - startIndex;

    if (countSoFar === 0) {
      accMin += nextMin;
      cursor++;
      if (accMin >= effectiveTargetMin && countSoFar + 1 >= minItemsForPace) {
        break;
      }
      continue;
    }

    // Stop once we have enough items for pace AND adding another pushes us too far past target
    const newTotal = accMin + nextMin;
    const distBefore = Math.abs(effectiveTargetMin - accMin);
    const distAfter = Math.abs(newTotal - effectiveTargetMin);

    if (countSoFar >= minItemsForPace && accMin >= effectiveTargetMin * 0.8) {
      if (newTotal > effectiveTargetMin * 1.25 || (newTotal > effectiveTargetMin && distAfter > distBefore)) {
        break;
      }
    }

    accMin = newTotal;
    cursor++;

    if (accMin >= effectiveTargetMin && cursor - startIndex >= minItemsForPace) {
      break;
    }
  }

  return { endIndex: cursor, pickedMinutes: accMin };
}

export function allocateCourseContentForDate(
  state: MasarState,
  course: Course,
  targetDate: string
): CourseContentDayAllocation {
  const referenceDate = state.activeDate;
  const dayMode = getDayModeLocal(state, targetDate);
  const isStudyDay = isStudyDayForQueue(state, targetDate, course.queue);

  const flatItems = flattenCourseItems(course);
  const completedOnTarget = flatItems
    .filter((f) => f.item.completed && f.item.completedAt === targetDate)
    .map<ContentDayEntry>((f) => ({
      topicId: f.topicId,
      topicTitle: f.topicTitle,
      itemId: f.item.id,
      itemTitle: f.item.title,
      sectionType: f.item.sectionType || 'section',
      estimatedMinutes: f.item.estimatedMinutes || 20,
      completed: true,
      completedAt: f.item.completedAt,
    }));

  // Past dates: only show items completed on that date
  if (targetDate < referenceDate) {
    const compMin = completedOnTarget.reduce((s, x) => s + x.estimatedMinutes, 0);
    return {
      date: targetDate,
      isStudyDay,
      dayMode,
      completedTodayItems: completedOnTarget,
      pendingItems: [],
      allDisplayItems: completedOnTarget,
      totalEstimatedMinutes: compMin,
      remainingMinutesToday: 0,
      completedTodayMinutes: compMin,
    };
  }

  const remainingPool = flatItems.filter((f) => !f.item.completed);
  const dailyBudgetMin = Math.max(15, Math.round((course.dailyStudyHours ?? 1.5) * 60));
  const horizonEnd =
    course.deadline && course.deadline >= targetDate
      ? course.deadline
      : addDaysLocal(targetDate > referenceDate ? targetDate : referenceDate, 60);

  const studyDaysHorizon = collectAvailableStudyDays(state, referenceDate, horizonEnd, course.queue, 365);
  const effectiveStudyDays =
    studyDaysHorizon.length > 0
      ? studyDaysHorizon
      : collectAvailableStudyDays(state, referenceDate, addDaysLocal(horizonEnd, 60), course.queue, 365);

  if (!isStudyDay || remainingPool.length === 0) {
    const compMin = completedOnTarget.reduce((s, x) => s + x.estimatedMinutes, 0);
    return {
      date: targetDate,
      isStudyDay,
      dayMode,
      completedTodayItems: completedOnTarget,
      pendingItems: [],
      allDisplayItems: completedOnTarget,
      totalEstimatedMinutes: compMin,
      remainingMinutesToday: 0,
      completedTodayMinutes: compMin,
    };
  }

  const deadlineDate = course.deadline && course.deadline >= referenceDate ? course.deadline : horizonEnd;
  const completedOnReferenceDateMinutes = flatItems
    .filter((f) => f.item.completed && f.item.completedAt === referenceDate)
    .reduce((s, f) => s + (f.item.estimatedMinutes || 20), 0);
  let poolCursor = 0;
  let targetSlice: FlatCourseItem[] = [];

  for (let dIdx = 0; dIdx < effectiveStudyDays.length; dIdx++) {
    const currentDay = effectiveStudyDays[dIdx];
    if (currentDay > targetDate || poolCursor >= remainingPool.length) break;

    const studyDaysRemainingUntilDeadline = effectiveStudyDays.filter(
      (d) => d >= currentDay && d <= deadlineDate
    ).length;

    const doneMinOnDay = currentDay === referenceDate ? completedOnReferenceDateMinutes : 0;

    const { endIndex } = pickItemsForDaySlice(
      remainingPool,
      poolCursor,
      dailyBudgetMin,
      Math.max(1, studyDaysRemainingUntilDeadline),
      doneMinOnDay
    );

    if (currentDay === targetDate) {
      targetSlice = remainingPool.slice(poolCursor, endIndex);
      break;
    }

    poolCursor = endIndex;
  }

  const pendingItems: PlannedContentItem[] = targetSlice.map((f) => ({
    topicId: f.topicId,
    topicTitle: f.topicTitle,
    itemId: f.item.id,
    itemTitle: f.item.title,
    sectionType: f.item.sectionType || 'section',
    estimatedMinutes: f.item.estimatedMinutes || 20,
  }));

  const pendingDisplay: ContentDayEntry[] = pendingItems.map((p) => ({
    topicId: p.topicId,
    topicTitle: p.topicTitle,
    itemId: p.itemId,
    itemTitle: p.itemTitle,
    sectionType: p.sectionType || 'section',
    estimatedMinutes: p.estimatedMinutes,
    completed: false,
  }));

  const allDisplayItems = [...completedOnTarget, ...pendingDisplay];
  const completedTodayMinutes = completedOnTarget.reduce((s, x) => s + x.estimatedMinutes, 0);
  const remainingMinutesToday = pendingItems.reduce((s, x) => s + x.estimatedMinutes, 0);

  return {
    date: targetDate,
    isStudyDay,
    dayMode,
    completedTodayItems: completedOnTarget,
    pendingItems,
    allDisplayItems,
    totalEstimatedMinutes: completedTodayMinutes + remainingMinutesToday,
    remainingMinutesToday,
    completedTodayMinutes,
  };
}

export function getCourseContentProgress(
  course: Course,
  state: MasarState,
  referenceDate: string
): CourseContentProgress {
  const flatItems = flattenCourseItems(course);
  const totalSections = flatItems.length;
  const completedItems = flatItems.filter((f) => f.item.completed);
  const remainingItems = flatItems.filter((f) => !f.item.completed);

  const completedSections = completedItems.length;
  const remainingSections = remainingItems.length;
  const percent = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  const totalMinutes = flatItems.reduce((s, f) => s + (f.item.estimatedMinutes || 20), 0);
  const completedMinutes = completedItems.reduce((s, f) => s + (f.item.estimatedMinutes || 20), 0);
  const remainingMinutes = remainingItems.reduce((s, f) => s + (f.item.estimatedMinutes || 20), 0);
  const estimatedRemainingHours = Number((remainingMinutes / 60).toFixed(1));

  const dailyBudgetMinutes = Math.max(15, Math.round((course.dailyStudyHours ?? 1.5) * 60));
  const deadline = course.deadline || null;
  const effectiveDeadline = deadline || addDaysLocal(referenceDate, 30);

  const studyDays = collectAvailableStudyDays(state, referenceDate, effectiveDeadline, course.queue, 365);
  const availableStudyDays = studyDays.length;
  const requiredMinutesPerDay =
    availableStudyDays > 0 ? Math.round(remainingMinutes / availableStudyDays) : remainingMinutes;

  let status: PacingStatus = 'on_track';
  if (remainingSections === 0 && totalSections > 0) {
    status = 'ahead';
  } else if (deadline && ((availableStudyDays === 0 && remainingSections > 0) || requiredMinutesPerDay > dailyBudgetMinutes * 1.15)) {
    status = 'behind';
  } else if (requiredMinutesPerDay <= dailyBudgetMinutes * 0.75) {
    status = 'ahead';
  }

  // Simulate realistic completion date at user's daily budget
  let estimatedCompletionDate: string | null = null;
  if (remainingSections === 0) {
    estimatedCompletionDate = referenceDate;
  } else {
    let cursor = referenceDate;
    let poolIdx = 0;
    for (let i = 0; i < 365 && poolIdx < remainingItems.length; i++) {
      if (isStudyDayForQueue(state, cursor, course.queue)) {
        const { endIndex } = pickItemsForDaySlice(remainingItems, poolIdx, dailyBudgetMinutes, 999, 0);
        poolIdx = Math.max(poolIdx + 1, endIndex);
        if (poolIdx >= remainingItems.length) {
          estimatedCompletionDate = cursor;
          break;
        }
      }
      cursor = addDaysLocal(cursor, 1);
    }
  }

  return {
    completedSections,
    totalSections,
    remainingSections,
    percent,
    totalMinutes,
    completedMinutes,
    remainingMinutes,
    estimatedRemainingHours,
    availableStudyDays,
    dailyBudgetMinutes,
    requiredMinutesPerDay,
    deadline,
    status,
    estimatedCompletionDate,
    isCompleted: totalSections > 0 && completedSections === totalSections,
  };
}

export function formatMinutesAsEffort(minutes: number, isAr = false): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return isAr ? `~${m} د` : `~${m}m`;
  if (m === 0) return isAr ? `~${h} س` : `~${h}h`;
  return isAr ? `~${h} س ${m} د` : `~${h}h ${m}m`;
}
