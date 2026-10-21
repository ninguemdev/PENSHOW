import type { MatchStage } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { Timer } from '../../ui/timer';
import type { RoundProps } from './round-props';

export function WagerSelection({
  stage,
  match,
  view,
  controls,
  now,
  stores,
}: RoundProps & { stage: Extract<MatchStage, { phase: 'wager-selection' }> }) {
  const attempt = controls.wagerAttempt;
  const amount = stage.ownWager.status === 'submitted' ? stage.ownWager.amount : attempt?.amount;
  const status = stage.ownWager.status === 'submitted' ? 'recorded' : attempt?.status;
  const expired = now + controls.offset >= stage.deadlineAt;
  const player = stage.ownWager.status !== 'unavailable';
  return (
    <>
      <h2 tabIndex={-1}>{strings.match.wagerChoose}</h2>
      <p>
        {strings.room.themeNames[stage.category] ?? stage.category} ·{' '}
        {strings.match.difficulty[stage.difficulty]}
      </p>
      {player && (
        <p>
          {strings.match.wagerBalance(
            match.scoreboard.find((entry) => entry.playerId === view.viewerId)?.points ?? 0,
          )}
        </p>
      )}
      <p id="wager-help">{strings.match.wagerHelp}</p>
      <Timer deadline={stage.deadlineAt} now={now} offset={controls.offset} />
      {player && (
        <div
          className="quiz-options"
          role="group"
          aria-label={strings.match.wagerChoose}
          aria-describedby="wager-help"
        >
          {stage.allowedAmounts.map((value) => (
            <Button
              key={value}
              aria-pressed={amount === value}
              disabled={
                controls.blocked || expired || stage.ownWager.status !== 'pending' || !!attempt
              }
              onClick={() => void controls.wager(value)}
            >
              {strings.match.wagerButton(value)}
            </Button>
          ))}
        </div>
      )}
      {status && (
        <p role="status">
          {status === 'recorded'
            ? strings.match.wagerRecorded(amount!)
            : status === 'sending'
              ? strings.match.wagerSending
              : strings.match.wagerUncertain}
        </p>
      )}
      {status === 'unconfirmed' && (
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
