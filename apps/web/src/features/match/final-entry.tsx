import type { FinalEntry as Entry, RoomView } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';

export function FinalEntry({ entry, view }: { entry: Entry; view: RoomView }) {
  return (
    <section aria-label={strings.final.entry}>
      <h3>{strings.final.entry}</h3>
      <p>{entry.scope === 'full-match' ? strings.room.classicDetail : strings.final.entryHelp}</p>
      {entry.status === 'ready' ? (
        <ol className="final-allocations" aria-label={strings.final.entry}>
          {entry.allocations.map((row) => (
            <li key={row.playerId}>
              {strings.final.allocation(
                view.members.find((member) => member.playerId === row.playerId)?.profile.nickname ??
                  strings.match.player,
                row.rank,
                entry.ranking.entries.find((score) => score.playerId === row.playerId)!.points,
                row.initialLives,
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p role="status">{strings.final.tiePending}</p>
      )}
    </section>
  );
}
