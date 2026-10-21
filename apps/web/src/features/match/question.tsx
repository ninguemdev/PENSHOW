import type { MatchStage } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { Timer } from '../../ui/timer';
import type { RoundProps } from './round-props';
import { AnswerOptions } from './answer-options';
import { QuestionFeedback } from './question-feedback';

export function QuestionReading({
  stage,
  now,
  controls,
}: RoundProps & { stage: Extract<MatchStage, { phase: 'question-reading' }> }) {
  return (
    <>
      <p className="eyebrow">{strings.match.reading}</p>
      <QuestionFeedback
        deadline={stage.opensAt}
        now={now}
        offset={controls.offset}
        message={strings.match.readingHelp}
      />
      <QuestionText question={stage.question} />
      {stage.ownWager?.status === 'submitted' && (
        <p>{strings.match.wagerOwn(stage.ownWager.amount)}</p>
      )}
    </>
  );
}
export function QuestionText({
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
      <QuestionFeedback
        deadline={stage.deadlineAt}
        now={now}
        offset={controls.offset}
        message={
          status
            ? strings.match[
                status === 'sending' ? 'sending' : status === 'recorded' ? 'recorded' : 'uncertain'
              ]
            : undefined
        }
      />
      <QuestionText question={stage.question} />
      {stage.ownWager?.status === 'submitted' && (
        <p>{strings.match.wagerOwn(stage.ownWager.amount)}</p>
      )}
      <p id="answer-help">{strings.match.answerHelp}</p>
      <AnswerOptions
        options={stage.question.options}
        selected={choice}
        helpId="answer-help"
        disabled={
          controls.blocked ||
          stage.ownAnswer.status !== 'pending' ||
          !!controls.attempt ||
          expired ||
          now + controls.offset < stage.opensAt
        }
        onAnswer={(optionId) => void controls.answer(optionId)}
      />
      <p role="status">
        {strings.match.answered(
          stage.answeredPlayerIds.length,
          stage.respondents.kind === 'single-player' ? 1 : match.scoreboard.length,
        )}
      </p>
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
  match,
  view,
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
      {match.speedRules && (
        <ul aria-label={strings.match.bonus}>
          {match.scoreboard.map((score) => {
            const effects = stage.effects.filter((effect) => effect.playerId === score.playerId);
            const base = effects.find((effect) => effect.reason === 'correct-answer')?.amount ?? 0;
            const bonus = effects.find((effect) => effect.reason === 'speed-bonus')?.amount ?? 0;
            return (
              <li key={score.playerId}>
                {
                  view.members.find((member) => member.playerId === score.playerId)?.profile
                    .nickname
                }
                : {strings.match.speedBreakdown(base, bonus, base + bonus)}
              </li>
            );
          })}
        </ul>
      )}
      {stage.wagerResults && (
        <ul aria-label={strings.match.wagerResults}>
          {stage.wagerResults.map((result) => (
            <li key={result.playerId}>
              {view.members.find((member) => member.playerId === result.playerId)?.profile.nickname}
              :{' '}
              {strings.match.wagerResult(result.amount, result.balanceBefore, result.balanceAfter)}
            </li>
          ))}
        </ul>
      )}
      {stage.theftResult && (
        <>
          <p>
            {stage.theftResult.targetPlayerId && stage.theftResult.attackerPlayerId
              ? strings.match.theftTransfer(
                  view.members.find(
                    (member) => member.playerId === stage.theftResult!.attackerPlayerId,
                  )?.profile.nickname ?? strings.match.player,
                  view.members.find(
                    (member) => member.playerId === stage.theftResult!.targetPlayerId,
                  )?.profile.nickname ?? strings.match.player,
                  stage.theftResult.amount,
                )
              : strings.match.theftNone}
          </p>
          <ul aria-label={strings.match.theftBalances}>
            {stage.theftResult.balances.map((balance) => (
              <li key={balance.playerId}>
                {
                  view.members.find((member) => member.playerId === balance.playerId)?.profile
                    .nickname
                }
                :{' '}
                {strings.match.theftBalance(
                  balance.balanceBefore,
                  balance.correctPoints,
                  balance.transfer,
                  balance.balanceAfter,
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <Timer deadline={stage.deadlineAt} now={now} offset={controls.offset} />
    </>
  );
}
