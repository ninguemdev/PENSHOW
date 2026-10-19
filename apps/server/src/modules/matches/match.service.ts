import { roundIdSchema } from '@penshow/shared';
import { PublicCommandError } from '../../command-error.js';
import type { CancelTask, Runtime } from '../../ports.js';
import type { QuizLifecycle, RoomActor } from '../rooms/room.service.js';
import type { QuizRoster, Room, RoomState } from '../rooms/room.js';
import type { QuestionRepository } from '../questions/question.repository.js';
import { QuestionSelection } from '../questions/question-selection.js';
import { SelectionError } from '../questions/selection-policy.js';
import { freezeMatchRules, type PrototypeParameters } from '../scoring/match-rules.js';
import {
  createMatch,
  currentRound,
  matchTimer,
  MatchError,
  sameTimer,
  transitionMatch,
  type MatchInput,
  type MatchEffect,
  type MatchEvent,
  type MatchState,
  type MatchSession,
  type MatchTimer,
} from './match.domain.js';
import { classicStrategy, StrategyRegistry } from './match-strategy.js';

interface Dependencies {
  runtime: Runtime;
  questions: QuestionRepository;
  parameters?: PrototypeParameters;
  strategies?: StrategyRegistry;
  isCurrentActor?: (actor: RoomActor) => boolean;
  onError?: () => void;
}
interface ScheduledMatch {
  context: MatchTimer;
  cancel: CancelTask;
}

/** Classic prototype lifecycle, installed by the app only outside production. */
export class MatchService implements QuizLifecycle {
  private readonly strategies: StrategyRegistry;
  private readonly timers = new Map<Room, ScheduledMatch>();
  constructor(private readonly deps: Dependencies) {
    this.strategies = deps.strategies ?? new StrategyRegistry([classicStrategy]);
  }

  validateStart(roster: QuizRoster): MatchSession {
    const rules = freezeMatchRules(roster.matchId, this.deps.parameters);
    const result = QuestionSelection.create(this.deps.questions, this.deps.runtime, {
      matchId: roster.matchId,
      players: roster.players.map((player) => player.playerId),
      enabledCategories: roster.settings.enabledCategories,
      format: 'classic-prototype',
      rules,
    });
    if (result.status !== 'ready') throw new PublicCommandError('INSUFFICIENT_QUESTIONS');
    return {
      state: createMatch(
        roster,
        rules,
        [{ roundId: roundIdSchema.parse(this.deps.runtime.ids.next()), index: 1, mode: 'classic' }],
        this.strategies,
      ),
      selection: result.selection.checkpoint(),
    };
  }

  execute(room: Room, actor: RoomActor, command: MatchInput) {
    return room
      .runExclusive((tx) => {
        const member = tx.state.members.find((item) => item.playerId === actor.playerId);
        if (this.deps.isCurrentActor?.(actor) === false)
          throw new PublicCommandError('UNAUTHENTICATED');
        if (!member) throw new PublicCommandError('NOT_A_MEMBER');
        if (
          member.connection.status !== 'connected' ||
          member.connection.connectionId !== actor.connectionId
        )
          throw new PublicCommandError('UNAUTHENTICATED');
        if (tx.state.phase.status !== 'match' || !tx.state.phase.game)
          throw new PublicCommandError('INVALID_PHASE');
        if (member.role !== 'player') throw new PublicCommandError('FORBIDDEN');
        const result = this.apply(tx.state.phase.game, { ...command, playerId: actor.playerId });
        if (result.changed) {
          tx.state.phase.game = result.session;
          tx.touch();
        }
        return { stateVersion: tx.state.stateVersion };
      })
      .catch((error: unknown) => {
        if (error instanceof MatchError) throw new PublicCommandError(error.code);
        if (error instanceof SelectionError) throw new PublicCommandError('INVALID_PHASE');
        throw error;
      });
  }

  /** Called after a room commit, before its views. Presence updates keep the existing timer. */
  committed(room: Room, after: RoomState) {
    const context =
      after.phase.status === 'match' && after.phase.game
        ? matchTimer(after.phase.game.state)
        : null;
    const previous = this.timers.get(room);
    if (previous && sameTimer(previous.context, context)) return;
    previous?.cancel();
    this.timers.delete(room);
    if (context) this.schedule(room, context, context.deadlineAt);
  }

  private schedule(room: Room, context: MatchTimer, deadlineAt: number) {
    const scheduled: ScheduledMatch = {
      context,
      cancel: this.deps.runtime.scheduler.scheduleAt(deadlineAt, async () => {
        try {
          await room.runExclusive((tx) => {
            if (
              this.timers.get(room) !== scheduled ||
              tx.state.phase.status !== 'match' ||
              !tx.state.phase.game ||
              !sameTimer(matchTimer(tx.state.phase.game.state), context)
            )
              return;
            const result = this.apply(tx.state.phase.game, { kind: 'timer', timer: context });
            if (result.changed) {
              tx.state.phase.game = result.session;
              tx.touch();
            }
          });
        } catch {
          try {
            this.deps.onError?.();
          } catch {
            /* Diagnostics never block the room. */
          }
          // Content/scoring failed before commit: retry the same context, never the effects of a commit.
          if (this.timers.get(room) === scheduled)
            this.schedule(room, context, this.deps.runtime.clock.now() + 1000);
        }
      }),
    };
    this.timers.set(room, scheduled);
  }

  private apply(session: MatchSession, event: MatchEvent) {
    const now = this.deps.runtime.clock.now();
    const selection = QuestionSelection.resume(session.selection, this.deps.runtime);
    let result = transitionMatch(session.state, event, now, this.strategies);
    let state = result.state;
    const changed = result.changed;
    const effects: MatchEffect[] = [...result.effects];
    // These few synchronous content operations mutate only the draft checkpoint.
    // Intermediate awaiting-* states are never committed or projected.
    const receive = (next: MatchEvent) => {
      result = transitionMatch(state, next, now, this.strategies);
      state = result.state;
      effects.push(...result.effects);
    };
    for (let index = 0; index < effects.length; index++) {
      const effect = effects[index]!;
      const round = currentRound(state);
      switch (effect.kind) {
        case 'offer-categories': {
          const offer = selection.openRound(round.roundId, round.mode, now);
          if (offer.status === 'interrupted')
            receive({ kind: 'interrupt', reason: 'insufficient-questions' });
          else if (offer.status === 'choosing') receive({ kind: 'category-offered', offer });
          else throw new Error('Seleção de tema fora de sequência.');
          break;
        }
        case 'select-category':
          selection.chooseCategory(round.roundId, effect.playerId, effect.category, now);
          break;
        case 'expire-category':
          selection.expireCategoryChoice(round.roundId, now);
          break;
        case 'next-question':
          if (effect.previousQuestionId)
            selection.advanceQuestion(round.roundId, effect.previousQuestionId);
          receive({
            kind: 'question-prepared',
            question: selection.currentQuestion(round.roundId),
          });
          break;
      }
    }
    return { changed, session: { state, selection: selection.checkpoint() } };
  }
}

export function matchContext(state: MatchState): {
  matchId: MatchState['roster']['matchId'];
  roundId: ReturnType<typeof currentRound>['roundId'];
} {
  return { matchId: state.roster.matchId, roundId: currentRound(state).roundId };
}
