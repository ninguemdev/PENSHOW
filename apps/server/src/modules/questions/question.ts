import type { OptionId, PublicQuestion } from '@penshow/shared';
import type { z } from 'zod';
import type {
  approvedQuestionSchema,
  editorialQuestionSchema,
  editorialReviewSchema,
  questionSourceSchema,
} from './editorial-question.schema.js';

export type QuestionSource = z.infer<typeof questionSourceSchema>;
export type EditorialReview = z.infer<typeof editorialReviewSchema>;
export type EditorialQuestion = z.infer<typeof editorialQuestionSchema>;
export type ApprovedQuestion = z.infer<typeof approvedQuestionSchema>;

// Somente o servidor associa IDs editoriais e alternativas públicas embaralhadas.
export interface PreparedQuestion {
  publicQuestion: PublicQuestion;
  editorialQuestionId: string;
  editorialOptionByPublicId: ReadonlyMap<OptionId, string>;
  correctOptionId: OptionId;
  explanation: string | null;
}
