export type Language = 'en' | 'ar';
export type ThemeMode = 'dark' | 'light' | 'system';
export type NavTab = 'today' | 'week' | 'roadmap' | 'library' | 'stats';

export type QueueId = 'nti' | 'extra' | 'activity' | 'language';
export type CourseStatus = 'completed' | 'current' | 'upcoming' | 'locked';
export type ItemKind = 'video' | 'pdf' | 'lab' | 'practice' | 'reading' | 'room' | 'challenge';
export type DayMode = 'study' | 'study_light' | 'travel_off' | 'catch_up';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'snoozed' | 'review_later';
export type PacingStatus = 'ahead' | 'on_track' | 'behind';

export type SectionContentType =
  | 'section'
  | 'quiz'
  | 'guided_exercise'
  | 'lab'
  | 'summary'
  | 'review';

export interface LearningItem {
  id: string;
  title: string;
  kind: ItemKind;
  sectionType?: SectionContentType;
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string; // YYYY-MM-DD
  url?: string;
  notes?: string;
  whatILearned?: string;
  whatBlockedMe?: string;
  keyCommand?: string;
  keyConcept?: string;
}

export interface Topic {
  id: string;
  title: string;
  estimatedMinutes: number;
  studied: boolean;
  recalled: boolean;
  recallDurationSeconds: number;
  recallMissedPoints: string[];
  rewatchCount: number;
  feynmanScore?: number;
  feynmanGaps?: string[];
  completedAt?: string;
  nextReviewDate?: string; // ISO YYYY-MM-DD
  reviewStage?: number; // 0 = +2d, 1 = +7d
  notes?: string;
  whatILearned?: string;
  whatBlockedMe?: string;
  keyCommand?: string;
  keyConcept?: string;
  items: LearningItem[];
  prerequisites?: string[];
}

export interface First20HoursPlan {
  subskills: string[];
  resources: string[];
  barriers: string[];
  hoursLogged: number;
}

export interface CertificateMeta {
  isCertified: boolean;
  examTargetDate?: string;
  revisionDays?: number;
  certificationStatus?: 'not_started' | 'preparing' | 'scheduled' | 'passed';
  voucherStatus?: 'none' | 'pending' | 'issued' | 'used';
}

export interface Course {
  id: string;
  queue: QueueId;
  order: number;
  title: string;
  titleAr?: string;
  platform?: string;
  status: CourseStatus;
  startDate?: string; // YYYY-MM-DD
  deadline?: string; // YYYY-MM-DD
  dailyStudyHours?: number;
  isContentPlanned?: boolean;
  linkedNtiCourseId?: string;
  estimatedHours: number;
  topics: Topic[];
  first20Hours?: First20HoursPlan;
  certificate?: CertificateMeta;
}

export interface PlannedContentItem {
  topicId: string;
  topicTitle: string;
  itemId: string;
  itemTitle: string;
  sectionType?: SectionContentType;
  estimatedMinutes: number;
}

export interface DailyTask {
  id: string;
  date: string; // YYYY-MM-DD
  category: 'workout' | 'nti' | 'extra' | 'activity' | 'language' | 'reading' | 'speaking' | 'review' | 'posture' | 'wind_down';
  title: string;
  subtitle?: string;
  courseId?: string;
  topicId?: string;
  plannedItems?: PlannedContentItem[];
  scheduledTime: string; // HH:mm
  estimatedMinutes: number;
  actualMinutes: number;
  status: TaskStatus;
  priority: number;
  isCatchUp?: boolean;
  isScreenBased: boolean;
  snoozedUntil?: string;
  notes?: string;
  whatILearned?: string;
  whatBlockedMe?: string;
  keyCommand?: string;
  keyConcept?: string;
}

export interface CtfEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  endDate?: string;
  url?: string;
  notes?: string;
  joined: boolean;
}

export interface SleepSettings {
  wakeTime: string; // "06:30"
  targetSleepHours: number; // 6-9, default 7
  eveningStartTime: string; // "17:30"
  ntiDaytimeStart: string; // "09:00"
  ntiDaytimeEnd: string; // "16:30"
}

export interface SleepLog {
  date: string;
  plannedBedtime: string;
  actualBedtime?: string;
  actualWakeTime?: string;
  hoursSlept?: number;
  sunlightDone: boolean;
}

export interface BlockDurations {
  nti: number;
  extra: number;
  activity: number;
  language: number;
  breakMinutes: number;
}

export type HabitCategory =
  | 'health'
  | 'learning'
  | 'productivity'
  | 'exercise'
  | 'hydration'
  | 'meditation'
  | 'sleep'
  | 'nutrition'
  | 'mindfulness'
  | 'custom';

export interface Habit {
  id: string;
  title: string;
  titleAr: string;
  category?: HabitCategory;
  targetDaysLabel: string;
  targetDays: number;
  completedDates: string[]; // YYYY-MM-DD
  currentStreak?: number;
  bestStreak?: number;
  reminderTime?: string;
  isCustom?: boolean;
}

export interface WorkoutExercise {
  id: string;
  name: string;
  nameAr: string;
  sets: number;
  targetReps: string;
  isTimed?: boolean;
  durationSec?: number;
  formTip: string;
  formTipAr: string;
}

export interface WorkoutPlan {
  id: 'A' | 'B' | 'C';
  name: string;
  nameAr: string;
  focus: string;
  focusAr: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutSetLog {
  exerciseId: string;
  completedSets: boolean[];
  repsPerSet?: number[];
  weightKg?: number;
}

export interface WorkoutSessionLog {
  id: string;
  date: string;
  planId: 'A' | 'B' | 'C' | 'posture' | 'mobility';
  sets: WorkoutSetLog[];
  notes?: string;
  completed: boolean;
  durationMinutes: number;
}

export interface BookItem {
  id: string;
  order: number;
  title: string;
  titleEn?: string;
  author?: string;
  totalPages: number;
  currentPage: number;
  dailyTargetPages: number;
  status: 'current' | 'upcoming' | 'completed';
  category: 'novel' | 'commute';
  linkedPdfId?: string;
  quotes: string[];
  ideas: string[];
  notes: string;
}

export interface PodcastItem {
  id: string;
  title: string;
  durationMinutes: number;
  progressMinutes: number;
  sourceUrl?: string;
  completed: boolean;
}

export interface PdfHighlight {
  id: string;
  page: number;
  text: string;
  color: 'cyan' | 'amber' | 'emerald' | 'violet';
  note?: string;
  createdAt: string;
}

export interface PdfDocumentMeta {
  id: string;
  name: string;
  sizeBytes: number;
  totalPages: number;
  lastPage: number;
  linkedBookId?: string;
  highlights: PdfHighlight[];
  addedAt: string;
}

export interface ResearchItem {
  id: string;
  title: string;
  url: string;
  source: string;
  tags: string[];
  notes: string;
  status: 'to_read' | 'reading' | 'summarized';
}

export interface SpeakingDay {
  day: number;
  topic: string;
  topicAr: string;
  instructions: string;
  completed: boolean;
  completedDate?: string;
  durationSeconds?: number;
  hasRecording?: boolean;
}

export type MindFrameworkId = 'stoicism' | 'epicureanism' | 'pragmatism' | 'confucianism' | 'transcendentalism';

export interface MindJournalEntry {
  id: string;
  date: string;
  weighingOnMe: string;
  framework: MindFrameworkId;
  practiceResponse: string;
  reflectionLine?: string;
}

export interface FocusSession {
  id: string;
  date: string;
  startedAt: string;
  category: QueueId | 'reading' | 'other';
  topicId?: string;
  topicTitle?: string;
  plannedMinutes: number;
  actualMinutes: number;
}

export interface QuizResult {
  id: string;
  topicId: string;
  topicTitle: string;
  date: string;
  score: number;
  total: number;
  weakAreas: string[];
}

export interface NotificationPrefs {
  enabled: boolean;
  quietHoursStart: string; // "22:30"
  quietHoursEnd: string; // "06:30"
  morningSummary: boolean;
  eveningReview: boolean;
  taskReminders: boolean;
  sleepReminders: boolean;
}

export interface MasarState {
  version: number;
  onboardingCompleted: boolean;
  language: Language;
  theme: ThemeMode;
  activeDate: string; // YYYY-MM-DD (defaults to current date)
  priorityOrder: QueueId[];
  blockDurations: BlockDurations;
  sleepSettings: SleepSettings;
  sleepLogs: Record<string, SleepLog>;
  weeklyTemplate: Record<number, DayMode>; // 0=Sun..6=Sat
  dateOverrides: Record<string, DayMode>; // YYYY-MM-DD -> DayMode
  courses: Course[];
  tasksByDate: Record<string, DailyTask[]>;
  ctfEvents: CtfEvent[];
  habits: Habit[];
  workoutLogs: WorkoutSessionLog[];
  nextWorkoutPlan: 'A' | 'B' | 'C';
  books: BookItem[];
  podcasts: PodcastItem[];
  pdfs: PdfDocumentMeta[];
  researchSources: string[];
  researchItems: ResearchItem[];
  researchWeeklyGoal: number;
  speakingDays: SpeakingDay[];
  mindEntries: MindJournalEntry[];
  focusSessions: FocusSession[];
  quizResults: QuizResult[];
  reviewOffsets: [number, number]; // default [2, 7]
  notificationPrefs: NotificationPrefs;
  windDownChecklist: Record<string, Record<string, boolean>>; // date -> itemKey -> done
  weeklyAiReviews: Record<string, {
    generatedAt: string;
    insights: string[];
    suggestions: string[];
    sleepObservation: string;
    dataSufficiency: string;
  }>;
}
