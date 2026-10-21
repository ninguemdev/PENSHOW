import type { RoomView, RoundSummary } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';

export function RoundHistory({ summaries, view }: { summaries: RoundSummary[]; view: RoomView }) {
  const modeName = (mode: RoundSummary['round']['mode']) =>
    mode === 'classic' && view.state.status === 'match' && view.state.match.format === 'classic'
      ? strings.match.simpleTitle
      : strings.results.modes[mode];
  return (
    <section aria-label={strings.results.history} className="round-history">
      <h2>{strings.results.history}</h2>
      <p>{strings.results.historyHelp}</p>
      {summaries.map((summary) => (
        <section key={summary.round.roundId} aria-label={modeName(summary.round.mode)}>
          <h3>{modeName(summary.round.mode)}</h3>
          <p>
            {strings.results.questions(summary.questionsPlayed)}
            {summary.status === 'interrupted' ? ` · ${strings.results.interrupted}` : ''}
          </p>
          <ul>
            {summary.players.map((player) => (
              <li key={player.playerId}>
                <strong>
                  {view.members.find((member) => member.playerId === player.playerId)?.profile
                    .nickname ?? strings.match.player}
                  :{' '}
                </strong>
                {strings.results.score(
                  player.pointsBefore,
                  player.pointsAfter,
                  player.pointsDelta,
                  player.correctAnswers,
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
