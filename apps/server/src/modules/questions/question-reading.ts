import type { PreparedQuestion } from './question.js';

/** The server reserves the actual recording duration plus a bounded loading margin for everyone. */
export function questionReadingMs(question: PreparedQuestion, minimumMs: number) {
  return question.narration ? Math.max(minimumMs, question.narration.durationMs + 1500) : minimumMs;
}
