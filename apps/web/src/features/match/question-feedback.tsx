import { Timer } from '../../ui/timer';

export function QuestionFeedback({
  deadline,
  now,
  offset,
  message,
}: {
  deadline: number;
  now: number;
  offset: number;
  message: string | undefined;
}) {
  return (
    <div className="question-feedback">
      <Timer deadline={deadline} now={now} offset={offset} />
      <p role="status" aria-atomic="true" className="answer-status">
        {message}
      </p>
    </div>
  );
}
