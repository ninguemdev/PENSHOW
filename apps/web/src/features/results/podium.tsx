import type { MatchStage, RoomView } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';
import { PlayerChip } from '../../ui/player-chip';

export function Podium({
  stage,
  view,
}: {
  stage: Extract<MatchStage, { phase: 'podium' }>;
  view: RoomView;
}) {
  const winner = view.members.find((member) => member.playerId === stage.standings[0]);
  return (
    <section aria-label={strings.results.title}>
      <h2 tabIndex={-1}>{strings.results.title}</h2>
      <p role="status">{strings.final.winner(winner?.profile.nickname ?? strings.match.player)}</p>
      <p>{strings.results.help}</p>
      <ol className="podium" aria-label={strings.results.order}>
        {stage.standings.map((playerId, index) => {
          const member = view.members.find((member) => member.playerId === playerId);
          const finalist = stage.finalists.find((player) => player.playerId === playerId)!;
          return (
            <li key={playerId}>
              <strong className="podium-rank">{index + 1}º</strong>
              <div>
                {member ? <PlayerChip member={member} /> : strings.match.player}
                <p>{strings.results.entry(finalist.rank, finalist.initialLives)}</p>
                <p>
                  {finalist.status === 'active'
                    ? strings.results.survived(finalist.lives)
                    : strings.results.eliminated(finalist.eliminationOrder)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p>{strings.results.rematchHelp}</p>
    </section>
  );
}
