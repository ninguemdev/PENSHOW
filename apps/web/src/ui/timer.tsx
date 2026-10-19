import { useNow } from './use-now';
import { remainingSeconds } from '../lib/time-sync';
import { strings } from '../strings/pt-BR';
export function Timer({
  deadline,
  offset = 0,
  now,
}: {
  deadline: number;
  offset?: number;
  now?: number;
}) {
  const clock = useNow(now === undefined);
  const remaining = remainingSeconds(deadline, now ?? clock, offset);
  return (
    <div className="timer">
      <span role="timer" aria-live="off" aria-label={strings.timer.label}>
        {strings.timer.label}: <strong>{strings.timer.seconds(remaining)}</strong>
      </span>
      <span className="sr-only" role="status">
        {remaining === 0 ? strings.timer.ended : ''}
      </span>
    </div>
  );
}
