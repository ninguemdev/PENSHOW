import type { RoomView, Scoreboard as Scores, ScoreEffect } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';
import { PlayerChip } from '../../ui/player-chip';

export function Scoreboard({
  view,
  scores,
  effects = [],
}: {
  view: RoomView;
  scores: Scores;
  effects?: ScoreEffect[];
}) {
  return (
    <section aria-labelledby="scoreboard-title" className="scoreboard">
      <h2 id="scoreboard-title">{strings.match.scoreboard}</h2>
      <div
        className="scoreboard-scroll"
        tabIndex={0}
        role="region"
        aria-label={strings.match.scoreboard}
      >
        <table>
          <caption className="sr-only">{strings.match.scoreboard}</caption>
          <thead>
            <tr>
              <th scope="col">{strings.match.player}</th>
              <th scope="col">{strings.match.points}</th>
              <th scope="col">{strings.match.correctAnswers}</th>
              <th scope="col">{strings.match.change}</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score) => {
              const member = view.members.find((member) => member.playerId === score.playerId);
              return (
                <tr key={score.playerId}>
                  <th scope="row">
                    {member ? <PlayerChip member={member} /> : strings.match.player}
                  </th>
                  <td>{score.points}</td>
                  <td>{score.correctAnswers}</td>
                  <td>
                    {effects
                      .filter((effect) => effect.playerId === score.playerId)
                      .map((effect, index) => (
                        <span className="score-change" key={index}>
                          {effect.kind === 'credit' ? '+' : '−'}
                          {effect.amount}{' '}
                          {effect.reason === 'correct-answer' ? strings.match.credit : ''}
                        </span>
                      ))}
                    {!effects.some((effect) => effect.playerId === score.playerId) &&
                      strings.match.noChange}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
