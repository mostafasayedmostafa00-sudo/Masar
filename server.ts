import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function safeParseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    });
  });

  // 1. Parse bulk course outline into Queue -> Course -> Topic -> Item
  app.post('/api/ai/parse-course', async (req, res) => {
    const { outlineText, queueName, language } = req.body as {
      outlineText?: string;
      queueName?: string;
      language?: 'en' | 'ar';
    };

    if (!outlineText || !outlineText.trim()) {
      res.status(400).json({ error: 'Outline text is required.' });
      return;
    }

    const ai = getAIClient();
    if (!ai) {
      res.status(503).json({ error: 'AI service is not configured on this server.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Convert this raw course outline into structured topics and items for the "${queueName || 'Learning'}" queue. Preserve the original language or respond in ${language === 'ar' ? 'Arabic/English as appropriate' : 'English'}. Estimate realistic minutes per item (15-60 mins). Outline:\n\n${outlineText}`,
        config: {
          systemInstruction:
            'You are a curriculum architect. Output valid JSON strictly matching the schema. Do not invent unrelated modules; extract and structure what the user pasted.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              courseTitle: { type: Type.STRING },
              topics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    estimatedMinutes: { type: Type.INTEGER },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          kind: { type: Type.STRING, description: 'video | pdf | lab | practice | reading' },
                          estimatedMinutes: { type: Type.INTEGER },
                        },
                        required: ['title', 'kind', 'estimatedMinutes'],
                      },
                    },
                  },
                  required: ['title', 'estimatedMinutes', 'items'],
                },
              },
            },
            required: ['courseTitle', 'topics'],
          },
        },
      });

      const parsed = safeParseJson(response.text, null);
      if (!parsed) {
        res.status(502).json({ error: 'AI returned malformed JSON.' });
        return;
      }
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      res.status(500).json({ error: message });
    }
  });

  // 2. First 20 Hours deconstruction for a course
  app.post('/api/ai/first-20-hours', async (req, res) => {
    const { courseTitle, queue, language } = req.body as {
      courseTitle?: string;
      queue?: string;
      language?: 'en' | 'ar';
    };

    if (!courseTitle) {
      res.status(400).json({ error: 'courseTitle is required.' });
      return;
    }

    const ai = getAIClient();
    if (!ai) {
      res.status(503).json({ error: 'AI service is not configured on this server.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Apply Josh Kaufman's First 20 Hours method to "${courseTitle}" (Queue: ${queue || 'NTI'}). Language: ${language === 'ar' ? 'Arabic' : 'English'}.`,
        config: {
          systemInstruction:
            'Deconstruct the skill/course into 3-5 high-leverage subskills, 2-3 reliable resources, and common learning barriers. Keep items concise and practical.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subskills: { type: Type.ARRAY, items: { type: Type.STRING } },
              resources: { type: Type.ARRAY, items: { type: Type.STRING } },
              barriers: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['subskills', 'resources', 'barriers'],
          },
        },
      });

      const parsed = safeParseJson(response.text, null);
      if (!parsed) {
        res.status(502).json({ error: 'AI returned malformed JSON.' });
        return;
      }
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      res.status(500).json({ error: message });
    }
  });

  // 3. Feynman Technique analyzer
  app.post('/api/ai/feynman', async (req, res) => {
    const { topicTitle, explanation, language } = req.body as {
      topicTitle?: string;
      explanation?: string;
      language?: 'en' | 'ar';
    };

    if (!topicTitle || !explanation || explanation.trim().length < 15) {
      res.status(400).json({ error: 'Provide a topic title and a meaningful explanation.' });
      return;
    }

    const ai = getAIClient();
    if (!ai) {
      res.status(503).json({ error: 'AI service is not configured on this server.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Topic: "${topicTitle}"\nUser's simple explanation:\n"${explanation}"\n\nEvaluate clarity in ${language === 'ar' ? 'Arabic' : 'English'}.`,
        config: {
          systemInstruction:
            'Evaluate the explanation using the Feynman Technique. Identify unclear sections, unexplained technical jargon, concrete knowledge gaps that should become revision candidates, and give an honest clarity score from 0 to 100.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.INTEGER },
              unclearSections: { type: Type.ARRAY, items: { type: Type.STRING } },
              jargonFound: { type: Type.ARRAY, items: { type: Type.STRING } },
              knowledgeGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
              feedback: { type: Type.STRING },
            },
            required: ['score', 'unclearSections', 'jargonFound', 'knowledgeGaps', 'feedback'],
          },
        },
      });

      const parsed = safeParseJson(response.text, null);
      if (!parsed) {
        res.status(502).json({ error: 'AI returned malformed JSON.' });
        return;
      }
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      res.status(500).json({ error: message });
    }
  });

  // 4. 5-Question AI Quiz Generator after topic completion
  app.post('/api/ai/quiz', async (req, res) => {
    const { topicTitle, notes, courseTitle, language } = req.body as {
      topicTitle?: string;
      notes?: string;
      courseTitle?: string;
      language?: 'en' | 'ar';
    };

    if (!topicTitle) {
      res.status(400).json({ error: 'topicTitle is required.' });
      return;
    }

    const ai = getAIClient();
    if (!ai) {
      res.status(503).json({ error: 'AI service is not configured on this server.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Generate a 5-question verification quiz for topic "${topicTitle}" in course "${courseTitle || 'Cybersecurity'}". User notes: "${notes || 'None'}". Language: ${language === 'ar' ? 'Arabic' : 'English'}. Include 4 multiple-choice questions (4 options each) and 1 concise short-answer question.`,
        config: {
          systemInstruction:
            'Create an accurate technical verification quiz testing real understanding, not trivia. Provide exact correctAnswer strings (for MCQ, match one of the options verbatim).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING, description: 'mcq or short' },
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ['id', 'type', 'question', 'correctAnswer', 'explanation'],
                },
              },
            },
            required: ['questions'],
          },
        },
      });

      const parsed = safeParseJson(response.text, null);
      if (!parsed) {
        res.status(502).json({ error: 'AI returned malformed JSON.' });
        return;
      }
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      res.status(500).json({ error: message });
    }
  });

  // 5. Weekly AI Review (strictly grounded in user's actual data)
  app.post('/api/ai/weekly-review', async (req, res) => {
    const { metrics, language } = req.body as {
      metrics?: Record<string, unknown>;
      language?: 'en' | 'ar';
    };

    if (!metrics) {
      res.status(400).json({ error: 'metrics payload is required.' });
      return;
    }

    const ai = getAIClient();
    if (!ai) {
      res.status(503).json({ error: 'AI service is not configured on this server.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Analyze this user's actual weekly metrics JSON and produce 3 grounded insights, 3 practical suggestions, and a sleep observation in ${language === 'ar' ? 'Arabic' : 'English'}.\n\nMetrics:\n${JSON.stringify(metrics, null, 2)}`,
        config: {
          systemInstruction:
            'Only state conclusions directly supported by the numbers in Metrics. If there are fewer than 3 logged sessions/days, explicitly set dataSufficiency to "limited" and state what data is still missing rather than inventing patterns.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              insights: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              sleepObservation: { type: Type.STRING },
              dataSufficiency: { type: Type.STRING, description: 'sufficient or limited' },
            },
            required: ['insights', 'suggestions', 'sleepObservation', 'dataSufficiency'],
          },
        },
      });

      const parsed = safeParseJson<Record<string, unknown> | null>(response.text, null);
      if (!parsed || typeof parsed !== 'object') {
        res.status(502).json({ error: 'AI returned malformed JSON.' });
        return;
      }
      const insights = Array.isArray(parsed.insights) ? parsed.insights.map(String) : [];
      const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [];
      if (insights.length === 0 && suggestions.length === 0) {
        res.status(502).json({ error: 'AI returned incomplete weekly review data.' });
        return;
      }
      res.json({
        insights,
        suggestions,
        sleepObservation: typeof parsed.sleepObservation === 'string' ? parsed.sleepObservation : '',
        dataSufficiency: parsed.dataSufficiency === 'sufficient' ? 'sufficient' : 'limited',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      res.status(500).json({ error: message });
    }
  });

  // 6. Mind Compass philosophical reflection recommender
  app.post('/api/ai/mind-recommend', async (req, res) => {
    const { feelingText, selectedTag, language } = req.body as {
      feelingText?: string;
      selectedTag?: string;
      language?: 'en' | 'ar';
    };

    const ai = getAIClient();
    if (!ai) {
      res.status(503).json({ error: 'AI service is not configured on this server.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `User check-in ("What is weighing on me?"): Tag="${selectedTag || ''}", Note="${feelingText || ''}". Respond in ${language === 'ar' ? 'Arabic' : 'English'}.`,
        config: {
          systemInstruction:
            'Recommend one of the 5 philosophical frameworks (stoicism, epicureanism, pragmatism, confucianism, transcendentalism) as a reflective tool—never present as medical or psychological therapy. Provide a grounded reflective prompt and concrete 10-15 minute practice.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              framework: {
                type: Type.STRING,
                description: 'stoicism | epicureanism | pragmatism | confucianism | transcendentalism',
              },
              rationale: { type: Type.STRING },
              practicePrompt: { type: Type.STRING },
            },
            required: ['framework', 'rationale', 'practicePrompt'],
          },
        },
      });

      const parsed = safeParseJson(response.text, null);
      if (!parsed) {
        res.status(502).json({ error: 'AI returned malformed JSON.' });
        return;
      }
      res.json(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI request failed';
      res.status(500).json({ error: message });
    }
  });

  // Vite dev middleware or production static serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Masar OS server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start Masar OS server:', err);
  process.exit(1);
});
