import { createStore } from 'zustand/vanilla';
import { actionIdSchema, type ClientCommand, type OptionId, type RoomView } from '@penshow/shared';
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
      'match:start' | 'round:ready' | 'category:choose' | 'answer:submit' | 'match:returnToLobby';
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
  status: 'sending' | 'recorded' | 'unconfirmed';
}
/** Bind local feedback to one authenticated connection and one authoritative stage. */
export function matchActionKey(view: RoomView | null, epoch: number): string {
  if (!view) return `${epoch}:none`;
  if (view.state.status !== 'match')
    return `${epoch}:${view.roomId}:${view.viewerId}:${view.state.status}`;
  const { matchId, stage, progress } = view.state.match;
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
  return createStore<{
    busyKey: string | null;
    error: string | null;
    errorKey: string | null;
    attempt: AnswerAttempt | null;
    start: () => Promise<boolean>;
    ready: () => Promise<boolean>;
    chooseCategory: (category: string) => Promise<boolean>;
    answer: (optionId: OptionId) => Promise<boolean>;
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
    }
    function before(deadline: number) {
      if ((deps.now ?? Date.now)() + deps.session.getState().offset >= deadline)
        throw new Error(strings.match.waitingUpdate);
    }
    async function run(make: (view: RoomView) => Intent, optionId?: OptionId) {
      const session = deps.session.getState(),
        view = deps.room.getState().view;
      const key = matchActionKey(view, session.connectionEpoch);
      if (get().busyKey === key || (optionId && get().attempt?.key === key)) return false;
      const version = ++generation;
      try {
        if (session.status !== 'active' || session.connection !== 'online' || !session.session)
          throw new Error(strings.errors.offlineAction);
        if (!session.viewReady || !view || view.viewerId !== session.session.playerId)
          throw new Error(strings.match.waitingView);
        const intent = make(view);
        set({
          busyKey: key,
          error: null,
          errorKey: null,
          ...(optionId ? { attempt: { key, optionId, status: 'sending' as const } } : {}),
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
          if (optionId && ['INVALID_PAYLOAD', 'FORBIDDEN', 'NOT_A_MEMBER'].includes(ack.error.code))
            set({ attempt: null });
          throw new Error(ack.error.message);
        }
        if (ack.event !== intent.event) throw new Error(strings.errors.protocol);
        if (optionId) set({ attempt: { key, optionId, status: 'recorded' } });
        return true;
      } catch (error) {
        if (
          version === generation &&
          key === matchActionKey(deps.room.getState().view, deps.session.getState().connectionEpoch)
        ) {
          const attempt = get().attempt;
          set({
            error: error instanceof Error ? error.message : strings.errors.network,
            errorKey: key,
            ...(optionId && attempt?.key === key
              ? { attempt: { ...attempt, status: 'unconfirmed' as const } }
              : {}),
          });
        }
        return false;
      } finally {
        if (version === generation) set({ busyKey: null });
      }
    }
    return {
      busyKey: null,
      error: null,
      errorKey: null,
      attempt: null,
      start: () =>
        run((view) => {
          if (
            view.state.status !== 'lobby' ||
            !view.members.some((member) => member.playerId === view.viewerId && member.isHost) ||
            view.members.filter(
              (member) => member.role === 'player' && member.connection.status === 'connected',
            ).length < 2
          )
            unavailable();
          return { event: 'match:start', payload: { roomId: view.roomId } };
        }),
      ready: () =>
        run((view) => {
          participant(view);
          const stage = match(view).stage;
          if (stage.phase !== 'instructions' || stage.readyPlayerIds.includes(view.viewerId))
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
        run((view) => {
          participant(view);
          const stage = match(view).stage;
          if (
            stage.phase !== 'question-open' ||
            stage.ownAnswer.status !== 'pending' ||
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
        }, optionId),
      returnToLobby: () =>
        run((view) => {
          const current = match(view);
          if (
            !view.members.some((member) => member.playerId === view.viewerId && member.isHost) ||
            !['prototype-complete', 'interrupted'].includes(current.stage.phase)
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
}
