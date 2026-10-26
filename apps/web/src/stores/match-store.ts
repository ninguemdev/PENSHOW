import { createStore } from 'zustand/vanilla';
import {
  actionIdSchema,
  type ClientCommand,
  type OptionId,
  type PlayerId,
  type RoomView,
  type TiebreakInput,
} from '@penshow/shared';
import type { RealtimeClient } from '../lib/socket';
import type { createRoomStore } from './room-store';
import type { createSessionStore } from './session-store';
import { strings } from '../strings/pt-BR';

interface Dependencies {
  room: ReturnType<typeof createRoomStore>;
  session: ReturnType<typeof createSessionStore>;
  realtime: RealtimeClient;
  now?: () => number;
}
type MatchCommand = Extract<
  ClientCommand,
  {
    event:
      | 'match:start'
      | 'final:start'
      | 'round:ready'
      | 'category:choose'
      | 'answer:submit'
      | 'wager:submit'
      | 'target:choose'
      | 'match:returnToLobby'
      | 'tiebreak:answer';
  }
>;
type Intent = MatchCommand extends infer Command
  ? Command extends MatchCommand
    ? Omit<Command, 'protocolVersion' | 'actionId'>
    : never
  : never;
export interface AnswerAttempt {
  key: string;
  optionId: OptionId;
  status: 'sending' | 'recorded' | 'unconfirmed' | 'rejected';
  acceptance?: 'recorded' | 'first-valid';
}
export interface WagerAttempt {
  key: string;
  amount: number;
  status: Exclude<AnswerAttempt['status'], 'rejected'>;
}
interface TargetAttempt {
  key: string;
  targetPlayerId: PlayerId;
  status: WagerAttempt['status'];
}
type AttemptInput =
  | { kind: 'answer'; optionId: OptionId }
  | { kind: 'wager'; amount: number }
  | { kind: 'target'; targetPlayerId: PlayerId };
/** Bind local feedback to one authenticated connection and one authoritative stage. */
export function matchActionKey(view: RoomView | null, epoch: number): string {
  if (!view) return `${epoch}:none`;
  if (view.state.status !== 'match')
    return `${epoch}:${view.roomId}:${view.viewerId}:${view.state.status}`;
  const { matchId, stage, progress } = view.state.match;
  if (stage.phase === 'final-tiebreak') {
    const own = stage.tiebreak.ownQuestion;
    return `${epoch}:${view.roomId}:${view.viewerId}:${matchId}:${stage.tiebreak.frame.tiebreakId}:${stage.tiebreak.frame.bout}:${stage.tiebreak.frame.generation}:${stage.tiebreak.phase}:${'question' in own ? own.question.questionId : ''}`;
  }
  const questionId =
    'question' in stage
      ? stage.question.questionId
      : 'reveal' in stage
        ? stage.reveal.question.questionId
        : 'questionId' in stage
          ? stage.questionId
          : '';
  return `${epoch}:${view.roomId}:${view.viewerId}:${matchId}:${'round' in stage ? stage.round.roundId : ''}:${stage.phase}:${questionId}:${progress.questionNumber}`;
}

export function createMatchStore(deps: Dependencies) {
  let generation = 0;
  const store = createStore<{
    busyKey: string | null;
    error: string | null;
    errorKey: string | null;
    attempt: AnswerAttempt | null;
    wagerAttempt: WagerAttempt | null;
    targetAttempt: TargetAttempt | null;
    start: (mode?: 'classic' | 'speed' | 'wager' | 'theft' | 'pressure') => Promise<boolean>;
    startFinal: () => Promise<boolean>;
    ready: () => Promise<boolean>;
    chooseCategory: (category: string) => Promise<boolean>;
    answer: (optionId: OptionId) => Promise<boolean>;
    wager: (amount: number) => Promise<boolean>;
    target: (targetPlayerId: PlayerId) => Promise<boolean>;
    tiebreakInput: (input: TiebreakInput) => Promise<boolean>;
    survivalAnswer: (optionId: OptionId) => Promise<boolean>;
    returnToLobby: () => Promise<boolean>;
    cancel: () => void;
  }>((set, get) => {
    function unavailable(): never {
      throw new Error(strings.match.unavailable);
    }
    function match(view: RoomView) {
      if (view.state.status !== 'match') return unavailable();
      return view.state.match;
    }
    function context(view: RoomView) {
      const current = match(view);
      if (!('round' in current.stage)) return unavailable();
      return {
        roomId: view.roomId,
        matchId: current.matchId,
        roundId: current.stage.round.roundId,
      };
    }
    function participant(view: RoomView) {
      if (view.members.find((member) => member.playerId === view.viewerId)?.role !== 'player')
        unavailable();
      const stage = match(view).stage;
      if (
        'finalists' in stage &&
        stage.phase !== 'final-tiebreak' &&
        !stage.finalists.some(
          (player) => player.playerId === view.viewerId && player.status === 'active',
        )
      )
        unavailable();
    }
    function before(deadline: number) {
      if ((deps.now ?? Date.now)() + deps.session.getState().offset >= deadline)
        throw new Error(strings.match.waitingUpdate);
    }
    async function run(make: (view: RoomView) => Intent, attemptInput?: AttemptInput) {
      const optionId = attemptInput?.kind === 'answer' ? attemptInput.optionId : undefined;
      const amount = attemptInput?.kind === 'wager' ? attemptInput.amount : undefined;
      const targetPlayerId =
        attemptInput?.kind === 'target' ? attemptInput.targetPlayerId : undefined;
      const session = deps.session.getState(),
        view = deps.room.getState().view;
      const key = matchActionKey(view, session.connectionEpoch);
      if (get().busyKey === key || (optionId && get().attempt?.key === key)) return false;
      if (amount !== undefined && get().wagerAttempt?.key === key) return false;
      if (targetPlayerId && get().targetAttempt?.key === key) return false;
      const version = ++generation;
      let rejectedAnswer = false;
      try {
        if (session.status !== 'active' || session.connection !== 'online' || !session.session)
          throw new Error(strings.errors.offlineAction);
        if (!session.viewReady || !view || view.viewerId !== session.session.playerId)
          throw new Error(strings.match.waitingView);
        if (view.state.status === 'match' && view.state.match.waitingForPlayers)
          throw new Error(strings.match.waitingPlayers);
        const intent = make(view);
        set({
          busyKey: key,
          error: null,
          errorKey: null,
          ...(optionId ? { attempt: { key, optionId, status: 'sending' as const } } : {}),
          ...(amount !== undefined
            ? { wagerAttempt: { key, amount, status: 'sending' as const } }
            : {}),
          ...(targetPlayerId
            ? { targetAttempt: { key, targetPlayerId, status: 'sending' as const } }
            : {}),
        });
        const ack = await deps.realtime.command({
          ...intent,
          protocolVersion: 1,
          actionId: actionIdSchema.parse(crypto.randomUUID()),
        });
        if (
          version !== generation ||
          key !== matchActionKey(deps.room.getState().view, deps.session.getState().connectionEpoch)
        )
          return false;
        if (ack.status === 'error') {
          rejectedAnswer =
            !!optionId &&
            view.state.status === 'match' &&
            view.state.match.stage.phase === 'final-question-open' &&
            ['QUESTION_CLOSED', 'INVALID_PHASE', 'DEADLINE_EXPIRED', 'STALE_CONTEXT'].includes(
              ack.error.code,
            );
          if (
            optionId &&
            ['INVALID_PAYLOAD', 'FORBIDDEN', 'NOT_A_MEMBER', 'RATE_LIMITED'].includes(
              ack.error.code,
            )
          )
            set({ attempt: null });
          if (
            amount !== undefined &&
            [
              'INVALID_PAYLOAD',
              'INSUFFICIENT_BALANCE',
              'FORBIDDEN',
              'NOT_A_MEMBER',
              'RATE_LIMITED',
            ].includes(ack.error.code)
          )
            set({ wagerAttempt: null });
          if (
            targetPlayerId &&
            [
              'INVALID_PAYLOAD',
              'INVALID_TARGET',
              'FORBIDDEN',
              'NOT_A_MEMBER',
              'RATE_LIMITED',
            ].includes(ack.error.code)
          )
            set({ targetAttempt: null });
          throw new Error(ack.error.message);
        }
        if (ack.event !== intent.event) throw new Error(strings.errors.protocol);
        if (optionId && (ack.event === 'answer:submit' || ack.event === 'tiebreak:answer'))
          set({
            attempt: {
              key,
              optionId,
              status: 'recorded',
              acceptance: ack.event === 'answer:submit' ? ack.result.acceptance : 'recorded',
            },
          });
        if (amount !== undefined) set({ wagerAttempt: { key, amount, status: 'recorded' } });
        if (targetPlayerId) set({ targetAttempt: { key, targetPlayerId, status: 'recorded' } });
        return true;
      } catch (error) {
        if (
          version === generation &&
          key === matchActionKey(deps.room.getState().view, deps.session.getState().connectionEpoch)
        ) {
          const attempt = get().attempt;
          const wagerAttempt = get().wagerAttempt;
          const targetAttempt = get().targetAttempt;
          set({
            error: error instanceof Error ? error.message : strings.errors.network,
            errorKey: key,
            ...(optionId && attempt?.key === key
              ? {
                  attempt: {
                    ...attempt,
                    status: rejectedAnswer ? ('rejected' as const) : ('unconfirmed' as const),
                  },
                }
              : {}),
            ...(amount !== undefined && wagerAttempt?.key === key
              ? { wagerAttempt: { ...wagerAttempt, status: 'unconfirmed' as const } }
              : {}),
            ...(targetPlayerId && targetAttempt?.key === key
              ? { targetAttempt: { ...targetAttempt, status: 'unconfirmed' as const } }
              : {}),
          });
        }
        return false;
      } finally {
        if (version === generation) set({ busyKey: null });
      }
    }
    return {
      async tiebreakInput(input) {
        const view = deps.room.getState().view,
          session = deps.session.getState();
        if (
          !view ||
          !session.viewReady ||
          session.connection !== 'online' ||
          view.state.status !== 'match' ||
          view.state.match.stage.phase !== 'final-tiebreak' ||
          view.state.match.stage.tiebreak.phase !== 'combat'
        )
          return false;
        try {
          const ack = await deps.realtime.command({
            protocolVersion: 1,
            actionId: actionIdSchema.parse(crypto.randomUUID()),
            event: 'tiebreak:input',
            payload: { ...context(view), ...input },
          });
          return ack.status === 'ok';
        } catch {
          return false;
        }
      },
      survivalAnswer: (optionId) =>
        run(
          (view) => {
            participant(view);
            const stage = match(view).stage;
            if (stage.phase !== 'final-tiebreak') return unavailable();
            const own = stage.tiebreak.ownQuestion;
            if (
              own.status !== 'open' ||
              own.submitted ||
              !own.question.options.some((o) => o.optionId === optionId)
            )
              return unavailable();
            before(own.deadlineAt);
            const frame = stage.tiebreak.frame;
            return {
              event: 'tiebreak:answer',
              payload: {
                ...context(view),
                tiebreakId: frame.tiebreakId,
                bout: frame.bout,
                generation: frame.generation,
                questionId: own.question.questionId,
                optionId,
              },
            };
          },
          { kind: 'answer', optionId },
        ),
      busyKey: null,
      error: null,
      errorKey: null,
      attempt: null,
      wagerAttempt: null,
      targetAttempt: null,
      start: (mode) =>
        run((view) => {
          if (
            view.state.status !== 'lobby' ||
            !view.members.some((member) => member.playerId === view.viewerId && member.isHost) ||
            view.members.filter(
              (member) => member.role === 'player' && member.connection.status === 'connected',
            ).length < 2
          )
            unavailable();
          return {
            event: 'match:start',
            payload: { roomId: view.roomId, ...(mode ? { mode } : {}) },
          };
        }),
      startFinal: () =>
        run((view) => {
          const current = match(view);
          if (
            current.stage.phase !== 'prototype-complete' ||
            current.finalEntry?.status !== 'ready' ||
            !view.members.some((member) => member.playerId === view.viewerId && member.isHost)
          )
            return unavailable();
          return {
            event: 'final:start',
            payload: { roomId: view.roomId, matchId: current.matchId },
          };
        }),
      ready: () =>
        run((view) => {
          participant(view);
          const stage = match(view).stage;
          if (stage.phase === 'final-tiebreak') {
            if (
              stage.tiebreak.phase !== 'instructions' ||
              !stage.tiebreak.participants.includes(view.viewerId) ||
              stage.tiebreak.readyPlayerIds.includes(view.viewerId)
            )
              return unavailable();
            before(stage.tiebreak.deadlineAt);
            return { event: 'round:ready', payload: context(view) };
          }
          if (
            (stage.phase !== 'instructions' && stage.phase !== 'final-instructions') ||
            stage.readyPlayerIds.includes(view.viewerId)
          )
            return unavailable();
          before(stage.deadlineAt);
          return { event: 'round:ready', payload: context(view) };
        }),
      chooseCategory: (category) =>
        run((view) => {
          participant(view);
          const stage = match(view).stage;
          if (
            stage.phase !== 'category-selection' ||
            stage.chooserPlayerId !== view.viewerId ||
            !stage.categories.includes(category)
          )
            return unavailable();
          before(stage.deadlineAt);
          return { event: 'category:choose', payload: { ...context(view), category } };
        }),
      answer: (optionId) =>
        run(
          (view) => {
            participant(view);
            const stage = match(view).stage;
            if (
              (stage.phase !== 'question-open' && stage.phase !== 'final-question-open') ||
              (stage.phase === 'question-open' &&
                (stage.ownAnswer.status !== 'pending' ||
                  (stage.respondents.kind === 'single-player' &&
                    stage.respondents.playerId !== view.viewerId))) ||
              !stage.question.options.some((option) => option.optionId === optionId)
            )
              return unavailable();
            before(stage.deadlineAt);
            if ((deps.now ?? Date.now)() + deps.session.getState().offset < stage.opensAt)
              return unavailable();
            return {
              event: 'answer:submit',
              payload: { ...context(view), questionId: stage.question.questionId, optionId },
            };
          },
          { kind: 'answer', optionId },
        ),
      wager: (amount) =>
        run(
          (view) => {
            participant(view);
            const stage = match(view).stage;
            if (
              stage.phase !== 'wager-selection' ||
              stage.ownWager.status !== 'pending' ||
              !stage.allowedAmounts.includes(amount)
            )
              return unavailable();
            before(stage.deadlineAt);
            return {
              event: 'wager:submit',
              payload: { ...context(view), questionId: stage.questionId, amount },
            };
          },
          { kind: 'wager', amount },
        ),
      target: (targetPlayerId) =>
        run(
          (view) => {
            participant(view);
            const stage = match(view).stage;
            if (
              (stage.phase !== 'theft-target-selection' &&
                stage.phase !== 'final-target-selection') ||
              (stage.phase === 'theft-target-selection'
                ? stage.attackerPlayerId
                : stage.acceptedAnswer.playerId) !== view.viewerId ||
              !stage.eligibleTargetIds.includes(targetPlayerId)
            )
              return unavailable();
            before(stage.deadlineAt);
            return {
              event: 'target:choose',
              payload: {
                ...context(view),
                questionId:
                  stage.phase === 'theft-target-selection'
                    ? stage.questionId
                    : stage.reveal.question.questionId,
                targetPlayerId,
              },
            };
          },
          { kind: 'target', targetPlayerId },
        ),
      returnToLobby: () =>
        run((view) => {
          const current = match(view);
          if (
            !view.members.some((member) => member.playerId === view.viewerId && member.isHost) ||
            ![
              'prototype-complete',
              'ranking',
              'interrupted',
              'podium',
              'final-no-answer-pending',
              'final-no-target-pending',
            ].includes(current.stage.phase)
          )
            return unavailable();
          return {
            event: 'match:returnToLobby',
            payload: { roomId: view.roomId, matchId: current.matchId },
          };
        }),
      cancel() {
        generation++;
        // An uncertain answer remains locked in this connection, even across navigation.
        set({ busyKey: null, error: null, errorKey: null });
      },
    };
  });
  const initial = deps.room.getState().view?.state;
  let observedMatchId = initial?.status === 'match' ? initial.match.matchId : null;
  deps.room.subscribe((next) => {
    const after = next.view?.state;
    // Discarding a view during navigation must not restore an uncertain attempt.
    if (!after) return;
    const incomingMatchId = after.status === 'match' ? after.match.matchId : null;
    if (observedMatchId && observedMatchId !== incomingMatchId) {
      generation++;
      store.setState({
        busyKey: null,
        error: null,
        errorKey: null,
        attempt: null,
        wagerAttempt: null,
        targetAttempt: null,
      });
    }
    observedMatchId = incomingMatchId;
  });
  return store;
}
