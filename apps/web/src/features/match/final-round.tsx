import type { MatchStage } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { Timer } from '../../ui/timer';
import { FinalEntry } from './final-entry';
import { QuestionText } from './question';
import type { RoundProps } from './round-props';
import { Podium } from '../results/podium';
import { AnswerOptions } from './answer-options';
import { QuestionFeedback } from './question-feedback';

type FinalStage = Extract<MatchStage, { finalists: unknown }>;

export function FinalRound({ view, match, controls, stores, now }: RoundProps) {
  const stage = match.stage;
  if (!('finalists' in stage)) return null;
  const name = (id: string) =>
    view.members.find((member) => member.playerId === id)?.profile.nickname ?? strings.match.player;
  const own = stage.finalists.find((player) => player.playerId === view.viewerId);
  const active =
    own?.status === 'active' &&
    view.members.some((member) => member.playerId === view.viewerId && member.role === 'player');
  const expired = 'deadlineAt' in stage && now + controls.offset >= stage.deadlineAt;
  const attempt = controls.attempt;
  const accepted =
    'acceptedAnswer' in stage
      ? stage.acceptedAnswer
      : stage.phase === 'final-resolution'
        ? stage.resolution
        : null;
  const paused =
    stage.phase === 'final-no-answer-pending' || stage.phase === 'final-no-target-pending';
  const canReturn = paused || stage.phase === 'podium';
  return (
    <>
      {own?.status === 'eliminated' && (
        <p role="status" className="storage-notice">
          {strings.final.watching}
        </p>
      )}
      <section aria-label={strings.final.lives}>
        <h2>{strings.final.lives}</h2>
        <ul className="final-lives" aria-label={strings.final.lives}>
          {stage.finalists.map((player) => (
            <li key={player.playerId}>
              <strong>{name(player.playerId)}</strong>
              <span>{strings.final.remaining(player.lives, player.initialLives)}</span>
              <span>
                {player.status === 'eliminated' ? strings.final.eliminated : strings.final.active}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {stage.phase === 'final-instructions' ? (
        <>
          <h2 tabIndex={-1}>{strings.final.instructions}</h2>
          {match.finalRules && (
            <p>
              {strings.final.rules(match.finalRules.responseMs, match.finalRules.targetSelectionMs)}
            </p>
          )}
          <p>{strings.final.pendingHelp}</p>
          {match.finalEntry && <FinalEntry view={view} entry={match.finalEntry} />}
          <Timer deadline={stage.deadlineAt} now={now} offset={controls.offset} />
          <p role="status">
            {strings.match.readyCount(stage.readyPlayerIds.length, stage.finalists.length)}
          </p>
          {active && (
            <Button
              disabled={controls.blocked || expired || stage.readyPlayerIds.includes(view.viewerId)}
              onClick={() => void controls.ready()}
            >
              {stage.readyPlayerIds.includes(view.viewerId)
                ? strings.match.readySent
                : strings.match.ready}
            </Button>
          )}
        </>
      ) : stage.phase === 'podium' ? (
        <Podium stage={stage} view={view} />
      ) : (
        <>
          {paused && <h2 tabIndex={-1}>{strings.final.paused}</h2>}
          {stage.phase === 'final-target-selection' && (
            <h2 tabIndex={-1}>{strings.final.target}</h2>
          )}
          {stage.phase === 'final-resolution' && <h2 tabIndex={-1}>{strings.final.resolution}</h2>}
          {stage.phase === 'final-question-open' && (
            <QuestionFeedback
              deadline={stage.deadlineAt}
              now={now}
              offset={controls.offset}
              message={
                attempt
                  ? attempt.status === 'sending'
                    ? strings.match.sending
                    : attempt.status === 'rejected'
                      ? strings.final.rejected
                      : attempt.status === 'recorded' && attempt.acceptance === 'first-valid'
                        ? strings.final.accepted
                        : strings.match.uncertain
                  : undefined
              }
            />
          )}
          {stage.phase === 'final-question-reading' && (
            <QuestionFeedback
              deadline={stage.opensAt}
              now={now}
              offset={controls.offset}
              message={strings.match.readingHelp}
            />
          )}
          {'question' in stage && <QuestionText question={stage.question} />}
          {accepted && <p role="status">{strings.final.first(name(accepted.playerId))}</p>}
          {stage.phase === 'final-question-open' && (
            <>
              <p id="final-answer-help">{strings.final.answerHelp}</p>
              {active ? (
                <AnswerOptions
                  options={stage.question.options}
                  selected={attempt?.optionId}
                  helpId="final-answer-help"
                  disabled={
                    controls.blocked ||
                    !!attempt ||
                    expired ||
                    now + controls.offset < stage.opensAt
                  }
                  onAnswer={(optionId) => void controls.answer(optionId)}
                />
              ) : (
                <ul>
                  {stage.question.options.map((option) => (
                    <li key={option.optionId}>{option.text}</li>
                  ))}
                </ul>
              )}
              {attempt?.status === 'unconfirmed' && (
                <Button
                  className="secondary"
                  disabled={!controls.online}
                  onClick={() => void stores.session.getState().initialize()}
                >
                  {strings.match.recover}
                </Button>
              )}
            </>
          )}
          {stage.phase === 'final-target-selection' && (
            <>
              <p>{strings.final.chooser(name(stage.acceptedAnswer.playerId))}</p>
              <QuestionFeedback
                deadline={stage.deadlineAt}
                now={now}
                offset={controls.offset}
                message={
                  controls.targetAttempt
                    ? controls.targetAttempt.status === 'sending'
                      ? strings.match.theftSending
                      : controls.targetAttempt.status === 'recorded'
                        ? strings.final.targetRecorded
                        : strings.match.theftUncertain
                    : undefined
                }
              />
              {active && view.viewerId === stage.acceptedAnswer.playerId && (
                <div className="quiz-options" role="group" aria-label={strings.final.target}>
                  {stage.eligibleTargetIds.map((id) => (
                    <Button
                      key={id}
                      aria-pressed={controls.targetAttempt?.targetPlayerId === id}
                      disabled={controls.blocked || !!controls.targetAttempt || expired}
                      onClick={() => void controls.target(id)}
                    >
                      {strings.final.attack(
                        name(id),
                        stage.finalists.find((player) => player.playerId === id)!.lives,
                        view.members.find((member) => member.playerId === id)?.connection.status !==
                          'connected',
                      )}
                    </Button>
                  ))}
                </div>
              )}
              {controls.targetAttempt?.status === 'unconfirmed' && (
                <Button
                  className="secondary"
                  disabled={!controls.online}
                  onClick={() => void stores.session.getState().initialize()}
                >
                  {strings.match.recover}
                </Button>
              )}
            </>
          )}
          {stage.phase === 'final-resolution' && (
            <>
              <FinalResult stage={stage} name={name} />
              <p>{strings.final.closed}</p>
              <Timer deadline={stage.deadlineAt} now={now} offset={controls.offset} />
            </>
          )}
          {paused && (
            <>
              <p role="status">
                {stage.phase === 'final-no-answer-pending'
                  ? strings.final.noAnswer
                  : strings.final.noTarget}
              </p>
              <p>{strings.final.pendingHelp}</p>
            </>
          )}
          {'reveal' in stage && <FinalReveal stage={stage} />}
          {expired && <p role="status">{strings.match.waitingUpdate}</p>}
        </>
      )}
      {canReturn &&
        (view.members.some((member) => member.playerId === view.viewerId && member.isHost) ? (
          <Button disabled={controls.blocked} onClick={() => void controls.returnToLobby()}>
            {stage.phase === 'podium' ? strings.results.rematch : strings.match.return}
          </Button>
        ) : (
          <p role="status">{strings.match.waitHost}</p>
        ))}
    </>
  );
}

function FinalReveal({ stage }: { stage: Extract<FinalStage, { reveal: unknown }> }) {
  return (
    <>
      <QuestionText question={stage.reveal.question} />
      <p className="revealed-answer">
        <strong>{strings.match.correct}: </strong>
        {
          stage.reveal.question.options.find(
            (option) => option.optionId === stage.reveal.correctOptionId,
          )?.text
        }
      </p>
      {stage.reveal.explanation && <p>{stage.reveal.explanation}</p>}
    </>
  );
}

function FinalResult({
  stage,
  name,
}: {
  stage: Extract<FinalStage, { phase: 'final-resolution' }>;
  name: (id: string) => string;
}) {
  const result = stage.resolution;
  const victim = stage.finalists.find(
    (player) =>
      player.playerId === (result.outcome === 'attack' ? result.targetPlayerId : result.playerId),
  )!;
  return (
    <div>
      <p>
        {result.outcome === 'wrong-answer'
          ? strings.final.wrong(name(result.playerId))
          : strings.final.attacked(name(result.playerId), name(result.targetPlayerId))}
      </p>
      <p>{strings.final.loss(name(victim.playerId), victim.lives + result.damage, victim.lives)}</p>
      {victim.status === 'eliminated' && <p>{strings.final.elimination(name(victim.playerId))}</p>}
    </div>
  );
}
