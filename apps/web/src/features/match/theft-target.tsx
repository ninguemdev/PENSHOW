import type { MatchStage } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { QuestionFeedback } from './question-feedback';
import type { RoundProps } from './round-props';

export function TheftTarget({
  view,
  match,
  stage,
  controls,
  now,
  stores,
}: RoundProps & { stage: Extract<MatchStage, { phase: 'theft-target-selection' }> }) {
  const attacker = view.members.find((member) => member.playerId === stage.attackerPlayerId);
  const permitted = view.viewerId === stage.attackerPlayerId && attacker?.role === 'player';
  const attempt = controls.targetAttempt;
  return (
    <>
      <h2 tabIndex={-1}>{strings.match.theftTargetTitle}</h2>
      <p>{strings.match.theftChooser(attacker?.profile.nickname ?? strings.match.player)}</p>
      <QuestionFeedback
        deadline={stage.deadlineAt}
        now={now}
        offset={controls.offset}
        message={
          attempt
            ? attempt.status === 'sending'
              ? strings.match.theftSending
              : attempt.status === 'recorded'
                ? strings.match.theftRecorded
                : strings.match.theftUncertain
            : undefined
        }
      />
      {permitted && (
        <div role="group" aria-label={strings.match.theftTargetTitle} className="quiz-options">
          {stage.eligibleTargetIds.map((playerId) => (
            <Button
              key={playerId}
              aria-pressed={attempt?.targetPlayerId === playerId}
              disabled={controls.blocked || !!attempt || now + controls.offset >= stage.deadlineAt}
              onClick={() => void controls.target(playerId)}
            >
              {strings.match.theftTarget(
                view.members.find((member) => member.playerId === playerId)?.profile.nickname ??
                  strings.match.player,
                match.scoreboard.find((score) => score.playerId === playerId)?.points ?? 0,
              )}
            </Button>
          ))}
        </div>
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
  );
}
