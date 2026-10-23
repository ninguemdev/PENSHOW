import type { ApprovedQuestion } from './question.js';
import type { QuestionAvailability } from './catalog-format.js';

export interface QuestionFilter {
  category?: string;
  difficulty?: ApprovedQuestion['difficulty'];
}
/** Private editorial records. QuestionSelection owns allocation, shuffling and opaque public IDs. */
export interface QuestionRepository {
  list(filter?: QuestionFilter): readonly ApprovedQuestion[];
  availability(): QuestionAvailability;
  narrationDuration?(editorialQuestionId: string): number | undefined;
}
