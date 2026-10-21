import type { RoomView } from '@penshow/shared';
import type { SoundId } from './sound-catalog';

export function soundForTransition(previous: RoomView | null, next: RoomView): SoundId | null {
  if (next.state.status !== 'match') return null;
  const match = next.state.match,
    stage = match.stage;
  if (stage.phase === 'instructions' || stage.phase === 'final-instructions') return 'start';
  if (stage.phase === 'podium') return 'victory';
  if (stage.phase === 'final-resolution') return 'damage';
  if (stage.phase === 'final-target-selection')
    return stage.acceptedAnswer.playerId === next.viewerId ? 'correct' : null;
  if (stage.phase !== 'reveal') return null;
  if (match.pressureTurn?.outcome === 'exploded') return 'explosion';
  const member = next.members.find((member) => member.playerId === next.viewerId);
  if (member?.role !== 'player') return null;
  if (stage.round.mode === 'pressure' && match.pressureTurn?.playerId !== next.viewerId)
    return null;
  if (
    !previous ||
    previous.state.status !== 'match' ||
    previous.state.match.matchId !== match.matchId
  )
    return null;
  const before = previous.state.match.scoreboard.find((score) => score.playerId === next.viewerId);
  const after = match.scoreboard.find((score) => score.playerId === next.viewerId);
  if (!before || !after) return null;
  return after.correctAnswers > before.correctAnswers ? 'correct' : 'wrong';
}

function transitionKey(view: RoomView) {
  if (view.state.status !== 'match') return 'lobby';
  const stage = view.state.match.stage;
  const questionId =
    'question' in stage
      ? stage.question.questionId
      : 'reveal' in stage
        ? stage.reveal.question.questionId
        : 'questionId' in stage
          ? stage.questionId
          : '';
  return `${'round' in stage ? stage.round.roundId : ''}:${stage.phase}:${questionId}`;
}

/** State belongs to the store, so React remounts cannot replay an already consumed cue. */
export function createSoundTracker() {
  let previous: RoomView | null = null,
    identity = '',
    epoch = -1,
    version = -1;
  const consumed = new Set<string>();
  let questionBefore: RoomView | null = null,
    questionKey = '';
  return {
    observe(view: RoomView | null, connectionEpoch: number, ready: boolean): SoundId | null {
      if (!view) {
        previous = null;
        return null;
      }
      const nextIdentity = `${view.roomId}:${view.viewerId}:${view.state.status === 'match' ? view.state.match.matchId : 'lobby'}`;
      const changedIdentity = identity !== nextIdentity;
      if (changedIdentity) {
        identity = nextIdentity;
        consumed.clear();
        version = -1;
      }
      if (changedIdentity || epoch !== connectionEpoch) {
        questionBefore = null;
        questionKey = '';
      }
      const before = previous;
      const baseline =
        !before ||
        epoch !== connectionEpoch ||
        !ready ||
        (changedIdentity &&
          before.state.status === 'match' &&
          view.state.status === 'match' &&
          view.state.match.stage.phase !== 'instructions');
      epoch = connectionEpoch;
      if (view.stateVersion < version) return null;
      previous = view;
      version = view.stateVersion;
      if (view.state.status === 'match') {
        const stage = view.state.match.stage;
        if (stage.phase === 'question-reading' || stage.phase === 'question-open') {
          const key = `${stage.round.roundId}:${stage.question.questionId}`;
          if (questionKey !== key) {
            questionKey = key;
            questionBefore = view;
          }
        }
      }
      const key = transitionKey(view);
      if (consumed.has(key)) return null;
      consumed.add(key);
      if (baseline || before.roomId !== view.roomId || before.viewerId !== view.viewerId)
        return null;
      const comparison =
        view.state.status === 'match' && view.state.match.stage.phase === 'reveal'
          ? questionBefore
          : before;
      return soundForTransition(comparison, view);
    },
  };
}
