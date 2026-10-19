import type { MatchStage } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';
import { Button } from '../../ui/button';
import { Timer } from '../../ui/timer';
import type { RoundProps } from './round-props';

export function Instructions({
  view,
  match,
  controls,
  now,
  stage,
}: RoundProps & { stage: Extract<MatchStage, { phase: 'instructions' }> }) {
  const ready = stage.readyPlayerIds.includes(view.viewerId);
  const player = view.members.some(
    (member) => member.playerId === view.viewerId && member.role === 'player',
  );
  return (
    <>
      <h2 tabIndex={-1}>{strings.match.instructions}</h2>
      <p>{strings.match.rules}</p>
      <Timer deadline={stage.deadlineAt} now={now} offset={controls.offset} />
      <p role="status">
        {strings.match.readyCount(stage.readyPlayerIds.length, match.scoreboard.length)}
      </p>
      {player && (
        <Button
          disabled={controls.blocked || ready || now + controls.offset >= stage.deadlineAt}
          onClick={() => void controls.ready()}
        >
          {ready ? strings.match.readySent : strings.match.ready}
        </Button>
      )}
    </>
  );
}
export function CategoryChoice({
  view,
  stage,
  controls,
  now,
}: RoundProps & { stage: Extract<MatchStage, { phase: 'category-selection' }> }) {
  const chooser = view.members.find((member) => member.playerId === stage.chooserPlayerId);
  return (
    <>
      <h2 tabIndex={-1}>{strings.match.category}</h2>
      <p>{strings.match.chooser(chooser?.profile.nickname ?? strings.match.player)}</p>
      <Timer deadline={stage.deadlineAt} now={now} offset={controls.offset} />
      <div className="quiz-options" role="group" aria-label={strings.match.choose}>
        {stage.categories.map((category) => (
          <Button
            key={category}
            disabled={
              controls.blocked ||
              view.viewerId !== stage.chooserPlayerId ||
              now + controls.offset >= stage.deadlineAt
            }
            onClick={() => void controls.chooseCategory(category)}
          >
            {strings.room.themeNames[category] ?? category}
          </Button>
        ))}
      </div>
    </>
  );
}
