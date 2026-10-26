import { roundIdSchema, type MatchId, type PlayerId, type TiebreakInput } from '@penshow/shared';
import { prepareSurvivalQuestions, TiebreakError } from '../tiebreak/tiebreak.domain.js';
import { createFinal, FinalError } from '../final/final.domain.js';
import { PublicCommandError } from '../../command-error.js';
import type { CancelTask, Runtime } from '../../ports.js';
import type { QuizLifecycle, RoomActor } from '../rooms/room.service.js';
import type { QuizRoster, Room, RoomState } from '../rooms/room.js';
import type { QuestionRepository } from '../questions/question.repository.js';
import { QuestionSelection } from '../questions/question-selection.js';
import { SelectionError } from '../questions/selection-policy.js';
import { shuffled } from '../questions/theme-queue.domain.js';
import type { ThemeChoiceQueue } from '../questions/theme-queue.domain.js';
import { waitsForPlayers } from './match-presence.js';
import { createClassicPlan } from './classic-plan.js';
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
import {
  classicStrategy,
  speedStrategy,
  wagerStrategy,
  theftStrategy,
  pressureStrategy,
  StrategyRegistry,
} from './match-strategy.js';

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

/** Integrated classic and isolated scoring modes, installed only outside production. */
export class MatchService implements QuizLifecycle {
  private readonly strategies: StrategyRegistry;
  private readonly timers = new Map<Room, ScheduledMatch>();
  private readonly inputs = new Map<
    Room,
    Map<PlayerId, { actor: RoomActor; input: TiebreakInput; receivedAt: number }>
  >();
  constructor(private readonly deps: Dependencies) {
    this.strategies =
      deps.strategies ??
      new StrategyRegistry([
        classicStrategy,
        speedStrategy,
        wagerStrategy,
        theftStrategy,
        pressureStrategy,
      ]);
  }

  validateStart(roster: QuizRoster, previousChoiceQueue?: ThemeChoiceQueue): MatchSession {
    const mode = roster.prototypeMode ?? 'classic';
    const rules = freezeMatchRules(roster.matchId, this.deps.parameters);
    const plan =
      !roster.prototypeMode && roster.settings.format === 'classic'
        ? createClassicPlan(this.deps.runtime, rules.parameters.pressure.policy)
        : null;
    const result = QuestionSelection.create(this.deps.questions, this.deps.runtime, {
      matchId: roster.matchId,
      players: roster.players.map((player) => player.playerId),
      enabledCategories: roster.settings.enabledCategories,
      format: plan ? 'classic' : `${mode}-prototype`,
      ...(plan ? { modes: plan.rounds.map((round) => round.mode) } : {}),
      rules,
      ...(previousChoiceQueue ? { previousChoiceQueue } : {}),
    });
    if (result.status !== 'ready') throw new PublicCommandError('INSUFFICIENT_QUESTIONS');
    return {
      state: createMatch(
        roster,
        rules,
        plan?.rounds ?? [
          mode === 'pressure'
            ? {
                roundId: roundIdSchema.parse(this.deps.runtime.ids.next()),
                index: 5,
                mode,
                variant: { ...rules.parameters.pressure.policy },
              }
            : mode === 'theft'
              ? { roundId: roundIdSchema.parse(this.deps.runtime.ids.next()), index: 4, mode }
              : mode === 'wager'
                ? { roundId: roundIdSchema.parse(this.deps.runtime.ids.next()), index: 3, mode }
                : mode === 'speed'
                  ? { roundId: roundIdSchema.parse(this.deps.runtime.ids.next()), index: 2, mode }
                  : { roundId: roundIdSchema.parse(this.deps.runtime.ids.next()), index: 1, mode },
        ],
        this.strategies,
        (plan?.rounds.some((round) => round.mode === 'pressure') ?? mode === 'pressure')
          ? shuffled(
              roster.players.map((player) => player.playerId).sort(),
              this.deps.runtime.random,
            )
          : [],
        plan?.finalRound,
      ),
      selection: result.selection.checkpoint(),
    };
  }

  execute(room: Room, actor: RoomActor, command: MatchInput) {
    return this.transact(room, actor, (session) =>
      this.apply(session, { ...command, playerId: actor.playerId }),
    );
  }

  input(
    room: Room,
    actor: RoomActor,
    context: { matchId: MatchId; roundId: string },
    input: TiebreakInput,
  ) {
    return this.transact(room, actor, (session) => {
      const stage = session.state.final?.stage;
      if (
        session.state.roster.matchId !== context.matchId ||
        session.state.final?.round.roundId !== context.roundId
      )
        throw new MatchError('STALE_CONTEXT');
      if (stage?.phase !== 'final-tiebreak' || stage.tiebreak.phase !== 'combat')
        throw new MatchError('INVALID_PHASE');
      const tie = stage.tiebreak;
      if (
        input.tiebreakId !== tie.tiebreakId ||
        input.bout !== tie.bout ||
        input.generation !== tie.generation
      )
        throw new MatchError('STALE_CONTEXT');
      const fighter = tie.combat.fighters.find(
        (f) => f.playerId === actor.playerId && f.status === 'fighting',
      );
      if (!fighter) throw new MatchError('FORBIDDEN');
      let pending = this.inputs.get(room);
      if (!pending) {
        pending = new Map();
        this.inputs.set(room, pending);
      }
      const previous = pending.get(actor.playerId);
      if (input.sequence <= Math.max(fighter.lastSequence, previous?.input.sequence ?? -1))
        return { session, changed: false };
      pending.set(actor.playerId, {
        actor,
        input: structuredClone(input),
        receivedAt: this.deps.runtime.clock.now(),
      });
      return { session, changed: false };
    });
  }

  choiceQueueForRematch(session: MatchSession): ThemeChoiceQueue {
    return QuestionSelection.resume(session.selection, this.deps.runtime).choiceQueueForRematch();
  }

  startFinal(room: Room, actor: RoomActor, matchId: MatchId) {
    return this.transact(room, actor, (session, isHost) => {
      if (!isHost) throw new PublicCommandError('FORBIDDEN');
      if (session.state.roster.matchId !== matchId) throw new MatchError('STALE_CONTEXT');
      if (session.state.final) return { session, changed: false };
      if (
        session.state.stage.phase !== 'prototype-complete' ||
        session.state.finalEntry?.status !== 'ready'
      )
        throw new MatchError('INVALID_PHASE');
      const entry = session.state.finalEntry;
      const state = structuredClone(session.state),
        selection = QuestionSelection.resume(session.selection, this.deps.runtime);
      const roundId = roundIdSchema.parse(this.deps.runtime.ids.next());
      const minimum = entry.allocations.reduce((total, row) => total + row.initialLives, 0) - 1;
      if (selection.startPrototypeFinal(roundId, minimum).status === 'blocked')
        throw new PublicCommandError('INSUFFICIENT_QUESTIONS');
      state.final = createFinal(entry, state.rules, roundId, this.deps.runtime.clock.now());
      state.revision++;
      return { session: { state, selection: selection.checkpoint() }, changed: true };
    });
  }

  private transact(
    room: Room,
    actor: RoomActor,
    operation: (
      session: MatchSession,
      isHost: boolean,
    ) => { session: MatchSession; changed: boolean },
  ) {
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
        if (tx.state.phase.game.suspended) throw new PublicCommandError('INVALID_PHASE');
        const result = operation(tx.state.phase.game, tx.state.hostPlayerId === actor.playerId);
        if (result.changed) {
          tx.state.phase.game = result.session;
          tx.touch();
        }
        return { stateVersion: tx.state.stateVersion };
      })
      .catch((error: unknown) => {
        if (
          error instanceof MatchError ||
          error instanceof FinalError ||
          error instanceof TiebreakError
        )
          throw new PublicCommandError(error.code);
        if (error instanceof SelectionError) throw new PublicCommandError('INVALID_PHASE');
        throw error;
      });
  }

  /** Called after a room commit, before its views. Presence updates keep the existing timer. */
  committed(room: Room, after: RoomState) {
    const session = after.phase.status === 'match' ? after.phase.game : undefined;
    if (
      session?.state.final?.stage.phase !== 'final-tiebreak' ||
      session.state.final.stage.tiebreak.phase !== 'combat'
    )
      this.inputs.delete(room);
    const context =
      session && (!session.suspended || after.emptySince === null)
        ? matchTimer(session.state)
        : null;
    const previous = this.timers.get(room);
    if (previous && sameTimer(previous.context, context)) return;
    previous?.cancel();
    this.timers.delete(room);
    if (context)
      this.schedule(
        room,
        context,
        session?.suspended ? this.deps.runtime.clock.now() : context.deadlineAt,
      );
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
            if (tx.state.emptySince !== null && waitsForPlayers(tx.state.phase.game.state)) {
              tx.state.phase.game.suspended = true;
              tx.touch();
              return;
            }
            // Suspension keeps the original stage/deadline. Applying its expired timer
            // resumes only the next step; consumed answers, wagers and damage stay intact.
            const { suspended: _suspended, ...active } = tx.state.phase.game;
            void _suspended;
            const stage = active.state.final?.stage;
            if (stage?.phase === 'final-tiebreak' && stage.tiebreak.phase === 'combat') {
              const pending = this.inputs.get(room);
              for (const f of stage.tiebreak.combat.fighters) {
                const entry = pending?.get(f.playerId);
                const member = tx.state.members.find((m) => m.playerId === f.playerId);
                if (
                  f.input?.connectionId &&
                  (member?.connection.status !== 'connected' ||
                    member.connection.connectionId !== f.input.connectionId)
                )
                  f.input = null;
                if (
                  entry &&
                  entry.input.generation === stage.tiebreak.generation &&
                  entry.input.bout === stage.tiebreak.bout &&
                  member?.connection.status === 'connected' &&
                  member.connection.connectionId === entry.actor.connectionId &&
                  this.deps.isCurrentActor?.(entry.actor) !== false
                ) {
                  f.input = {
                    ...entry.input,
                    receivedAt: entry.receivedAt,
                    connectionId: entry.actor.connectionId,
                  };
                  f.lastSequence = entry.input.sequence;
                }
              }
              pending?.clear();
            }
            const connectedPlayerIds = tx.state.members
              .filter((m) => m.connection.status === 'connected')
              .map((m) => m.playerId);
            const finalists = active.state.final?.finalists ?? [];
            const result = this.apply(active, {
              kind: 'timer',
              timer: context,
              connectedPlayerIds,
              ...(stage?.phase === 'final-target-selection'
                ? {
                    randomIndex: this.deps.runtime.random.integer(
                      finalists.filter((p) => p.status === 'active').length,
                    ),
                  }
                : {}),
              ...(stage?.phase === 'final-resolution' && stage.resolution.outcome === 'no-answer'
                ? {
                    spawnOrder: shuffled(
                      finalists.map((p) => p.playerId),
                      this.deps.runtime.random,
                    ),
                  }
                : {}),
            });
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
    let content: QuestionSelection | undefined;
    // Movement-only steps keep the isolated transaction checkpoint unchanged.
    const selection = () =>
      (content ??= QuestionSelection.resume(session.selection, this.deps.runtime));
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
        case 'start-final': {
          const finalRound = state.finalRound;
          if (!finalRound) throw new Error('Plano da final ausente.');
          if (state.finalEntry?.status !== 'ready') break;
          if (selection().startFinal(finalRound.roundId).status !== 'ready') {
            state.stage = { phase: 'interrupted', reason: 'insufficient-questions' };
            break;
          }
          state.final = createFinal(state.finalEntry, state.rules, finalRound.roundId, now, 5);
          break;
        }
        case 'next-final-question': {
          const final = state.final;
          if (!final) throw new Error('Final ausente.');
          if (effect.previousQuestionId)
            selection().advanceFinalQuestion(final.round.roundId, effect.previousQuestionId);
          const question = selection().currentFinalQuestion(final.round.roundId);
          receive({
            kind: 'final-question-prepared',
            question: 'status' in question ? null : question,
          });
          break;
        }
        case 'offer-categories': {
          const offer = selection().openRound(round.roundId, round.mode, now);
          if (offer.status === 'interrupted')
            receive({ kind: 'interrupt', reason: 'insufficient-questions' });
          else if (offer.status === 'choosing') receive({ kind: 'category-offered', offer });
          else throw new Error('Seleção de tema fora de sequência.');
          break;
        }
        case 'select-category':
          selection().chooseCategory(round.roundId, effect.playerId, effect.category, now);
          break;
        case 'expire-category':
          selection().expireCategoryChoice(round.roundId, now);
          break;
        case 'next-question':
          if (effect.previousQuestionId)
            selection().advanceQuestion(round.roundId, effect.previousQuestionId);
          receive({
            kind: 'question-prepared',
            question: selection().currentQuestion(round.roundId),
          });
          break;
      }
    }
    const final = state.final;
    if (final?.stage.phase === 'final-tiebreak') {
      const tie = final.stage.tiebreak;
      if (tie.phase === 'questions' && !tie.questions.length) {
        const questions = selection().survivalQuestions(
          tie.pendingPlayerIds.length,
          final.finalists.some((p) => p.status === 'active'),
        );
        if ('status' in questions)
          final.stage = { phase: 'interrupted', reason: 'insufficient-questions' };
        else
          prepareSurvivalQuestions(tie, questions, now, state.rules.parameters.timings.readingMs);
      }
    }
    return { changed, session: { state, selection: content?.checkpoint() ?? session.selection } };
  }
}

export function matchContext(state: MatchState): {
  matchId: MatchState['roster']['matchId'];
  roundId: ReturnType<typeof currentRound>['roundId'];
} {
  return {
    matchId: state.roster.matchId,
    roundId: state.final?.round.roundId ?? currentRound(state).roundId,
  };
}
