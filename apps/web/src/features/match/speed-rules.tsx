import type { MatchView } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';

export function SpeedRules({ rules }: { rules: NonNullable<MatchView['speedRules']> }) {
  return (
    <aside aria-label={strings.match.speedRules}>
      <p>
        <strong>{strings.match.speedRules}</strong>
      </p>
      <p>{strings.match.speedBase(rules.correctPoints)}</p>
      <ul>
        {rules.bonusBands.map((band, index) => (
          <li key={band.beforeMs}>
            {strings.match.speedBand(
              index === 0 ? 0 : rules.bonusBands[index - 1]!.beforeMs,
              band.beforeMs,
              band.points,
            )}
          </li>
        ))}
      </ul>
      <p className="help-text">{strings.match.speedTiming}</p>
    </aside>
  );
}
