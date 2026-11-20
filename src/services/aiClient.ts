import { Language, MindFrameworkId } from '../types/masar';

export interface ParsedCourseResult {
  courseTitle: string;
  topics: Array<{
    title: string;
    estimatedMinutes: number;
    items: Array<{
      title: string;
      kind: 'video' | 'pdf' | 'lab' | 'practice' | 'reading';
      estimatedMinutes: number;
    }>;
  }>;
}

export interface First20HoursResult {
  subskills: string[];
  resources: string[];
  barriers: string[];
}

export interface FeynmanResult {
  score: number;
  unclearSections: string[];
  jargonFound: string[];
  knowledgeGaps: string[];
  feedback: string;
}

export interface QuizQuestion {
  id: string;
  type: 'mcq' | 'short';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
}

export interface WeeklyReviewResult {
  insights: string[];
  suggestions: string[];
  sleepObservation: string;
  dataSufficiency: 'sufficient' | 'limited';
}

export interface MindRecommendResult {
  framework: MindFrameworkId;
  rationale: string;
  practicePrompt: string;
}

async function postAi<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('AI unavailable offline.');
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `AI request failed (${res.status})`);
  }
  return data as T;
}

export const aiClient = {
  parseCourseOutline: (outlineText: string, queueName: string, language: Language) =>
    postAi<ParsedCourseResult>('/api/ai/parse-course', { outlineText, queueName, language }),

  generateFirst20Hours: (courseTitle: string, queue: string, language: Language) =>
    postAi<First20HoursResult>('/api/ai/first-20-hours', { courseTitle, queue, language }),

  evaluateFeynman: (topicTitle: string, explanation: string, language: Language) =>
    postAi<FeynmanResult>('/api/ai/feynman', { topicTitle, explanation, language }),

  generateQuiz: (topicTitle: string, notes: string, courseTitle: string, language: Language) =>
    postAi<{ questions: QuizQuestion[] }>('/api/ai/quiz', { topicTitle, notes, courseTitle, language }),

  generateWeeklyReview: (metrics: Record<string, unknown>, language: Language) =>
    postAi<WeeklyReviewResult>('/api/ai/weekly-review', { metrics, language }),

  recommendMindFramework: (feelingText: string, selectedTag: string, language: Language) =>
    postAi<MindRecommendResult>('/api/ai/mind-recommend', { feelingText, selectedTag, language }),
};
