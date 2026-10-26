import type { RoomView } from '@penshow/shared';
import type { SoundId } from './sound-catalog';

export function soundForTransition(previous: RoomView | null, next: RoomView): SoundId | null {
  if (next.state.status !== 'match') {
    if (!previous || previous.roomId !== next.roomId) return null;
    if (previous.state.status === 'match') return 'navigate';
    if (next.members.length > previous.members.length) return 'join';
    if (next.members.length < previous.members.length) return 'leave';
    return null;
  }
  const match = next.state.match,
    stage = match.stage;
  if (stage.phase === 'final-tiebreak') {
    if (stage.tiebreak.phase === 'instructions') return 'start';
    if (stage.tiebreak.ownQuestion.status === 'reading') return 'question';
    if (stage.tiebreak.ownQuestion.status === 'resolved')
      return stage.tiebreak.ownQuestion.outcome === 'correct' ? 'correct' : 'wrong';
    if (stage.tiebreak.phase === 'result') return 'results';
    const previousStage =
      previous?.state.status === 'match' ? previous.state.match.stage : undefined;
    if (
      previousStage?.phase === 'final-tiebreak' &&
      stage.tiebreak.frame.fighters.some(
        (f) =>
          f.lives <
          (previousStage.tiebreak.frame.fighters.find((p) => p.playerId === f.playerId)?.lives ??
            f.lives),
      )
    )
      return 'damage';
    return null;
  }
  if (stage.phase === 'instructions' || stage.phase === 'final-instructions') return 'start';
  if (stage.phase === 'question-reading' || stage.phase === 'final-question-reading')
    return 'question';
  if (
    stage.phase === 'category-selection' ||
    stage.phase === 'wager-selection' ||
    stage.phase === 'theft-target-selection'
  )
    return 'choice';
  if (stage.phase === 'round-results') return 'results';
  if (
    stage.phase === 'final-no-answer-pending' ||
    stage.phase === 'final-no-target-pending' ||
    stage.phase === 'ranking'
  )
    return 'notice';
  if (stage.phase === 'question-open') {
    if (stage.ownAnswer.status === 'submitted') return 'confirm';
    return 'open';
  }
  if (stage.phase === 'final-question-open') return 'open';
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
  if (view.state.status !== 'match')
    return `lobby:${view.members
      .map((member) => member.playerId)
      .sort()
      .join(',')}`;
  const stage = view.state.match.stage;
  if (stage.phase === 'final-tiebreak') {
    const own = stage.tiebreak.ownQuestion;
    return `tiebreak:${stage.tiebreak.frame.tiebreakId}:${stage.tiebreak.frame.bout}:${stage.tiebreak.frame.generation}:${stage.tiebreak.phase}:${own.status}:${stage.tiebreak.frame.fighters.map((f) => f.lives).join(',')}`;
  }
  const questionId =
    'question' in stage
      ? stage.question.questionId
      : 'reveal' in stage
        ? stage.reveal.question.questionId
        : 'questionId' in stage
          ? stage.questionId
          : '';
  const answer =
    stage.phase === 'question-open' && stage.ownAnswer.status === 'submitted'
      ? stage.ownAnswer.optionId
      : '';
  return `${'round' in stage ? stage.round.roundId : ''}:${stage.phase}:${questionId}:${answer}`;
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
      if (view.state.status !== 'match') {
        if (
          baseline ||
          !before ||
          before.roomId !== view.roomId ||
          before.viewerId !== view.viewerId ||
          before.stateVersion >= view.stateVersion
        )
          return null;
        return soundForTransition(before, view);
      }
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
