import type { MatchStage } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { Timer } from '../../ui/timer';
import type { RoundProps } from './round-props';

export function QuestionReading({
  stage,
  now,
  controls,
}: RoundProps & { stage: Extract<MatchStage, { phase: 'question-reading' }> }) {
  return (
    <>
      <p className="eyebrow">{strings.match.reading}</p>
      <QuestionText question={stage.question} />
      <p role="status">{strings.match.readingHelp}</p>
      <Timer deadline={stage.opensAt} now={now} offset={controls.offset} />
    </>
  );
}
function QuestionText({
  question,
}: {
  question: Extract<MatchStage, { phase: 'question-reading' }>['question'];
}) {
  return (
    <>
      <p className="question-meta">
        {strings.room.themeNames[question.category] ?? question.category} ·{' '}
        {strings.match.difficulty[question.difficulty]}
      </p>
      <h2 tabIndex={-1} className="question-prompt">
        {question.prompt}
      </h2>
    </>
  );
}
export function QuestionAnswer({
  stage,
  controls,
  now,
  stores,
  match,
}: RoundProps & { stage: Extract<MatchStage, { phase: 'question-open' }> }) {
  const expired = now + controls.offset >= stage.deadlineAt;
  const choice =
    stage.ownAnswer.status === 'submitted' ? stage.ownAnswer.optionId : controls.attempt?.optionId;
  const status = stage.ownAnswer.status === 'submitted' ? 'recorded' : controls.attempt?.status;
  return (
    <>
      <p className="eyebrow">{strings.match.answer}</p>
      <QuestionText question={stage.question} />
      <Timer deadline={stage.deadlineAt} now={now} offset={controls.offset} />
      <p id="answer-help">{strings.match.answerHelp}</p>
      <div
        className="quiz-options"
        role="group"
        aria-label={strings.match.answer}
        aria-describedby="answer-help"
      >
        {stage.question.options.map((option) => (
          <Button
            key={option.optionId}
            aria-pressed={choice === option.optionId}
            disabled={
              controls.blocked ||
              stage.ownAnswer.status !== 'pending' ||
              !!controls.attempt ||
              expired ||
              now + controls.offset < stage.opensAt
            }
            onClick={() => void controls.answer(option.optionId)}
          >
            {option.text}
          </Button>
        ))}
      </div>
      <p role="status">
        {strings.match.answered(stage.answeredPlayerIds.length, match.scoreboard.length)}
      </p>
      {status && (
        <p role="status" className="answer-status">
          {
            strings.match[
              status === 'sending' ? 'sending' : status === 'recorded' ? 'recorded' : 'uncertain'
            ]
          }
        </p>
      )}
      {status === 'unconfirmed' && !controls.waitingView && (
        <Button
          className="secondary"
          disabled={!controls.online}
          onClick={() => void stores.session.getState().initialize()}
        >
          {strings.match.recover}
        </Button>
      )}
      {expired && <p role="status">{strings.match.waitingUpdate}</p>}
    </>
  );
}
export function QuestionReveal({
  stage,
  controls,
  now,
}: RoundProps & { stage: Extract<MatchStage, { phase: 'reveal' }> }) {
  const answer = stage.reveal.question.options.find(
    (option) => option.optionId === stage.reveal.correctOptionId,
  );
  return (
    <>
      <p className="eyebrow">{strings.match.reveal}</p>
      <QuestionText question={stage.reveal.question} />
      <p className="revealed-answer">
        <strong>{strings.match.correct}: </strong>
        {answer?.text}
      </p>
      {stage.reveal.explanation && (
        <section aria-label={strings.match.explanation}>
          <p>{stage.reveal.explanation}</p>
        </section>
      )}
      <Timer deadline={stage.deadlineAt} now={now} offset={controls.offset} />
    </>
  );
}
