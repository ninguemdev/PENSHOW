import {
  categoryIdSchema,
  matchIdSchema,
  optionIdSchema,
  playerIdSchema,
  publicQuestionSchema,
  questionIdSchema,
  roundIdSchema,
  type MatchId,
  type PlayerId,
  type QuestionId,
  type RoundId,
} from '@penshow/shared';
import type { IdGenerator, RandomSource } from '../../ports.js';
import type { QuestionRepository } from './question.repository.js';
import type { ApprovedQuestion, PreparedQuestion } from './question.js';
import {
  canonicalQuestions,
  covers,
  phaseAllocation,
  stockOf,
  subtract,
  type Stock,
} from './question-pool.domain.js';
import {
  contentInterruption,
  demandSize,
  DIFFICULTIES,
  phaseDemand,
  selectionPolicy,
  SelectionError,
  type ContentInterruption,
  type Difficulty,
  type QuestionDemand,
  type SelectionFormat,
  type SelectionMode,
} from './selection-policy.js';
import {
  advanceChoiceQueue,
  choiceQueue,
  nextChooser,
  randomIndex,
  shuffled,
  type ThemeChoiceQueue,
} from './theme-queue.domain.js';
import {
  freezeMatchRules,
  PROTOTYPE_PARAMETERS,
  type FrozenMatchRules,
} from '../scoring/match-rules.js';

type CategoryId = ApprovedQuestion['category'];
interface SelectionOptions {
  matchId: MatchId;
  players: readonly PlayerId[];
  enabledCategories: readonly CategoryId[];
  format: SelectionFormat;
  previousChoiceQueue?: ThemeChoiceQueue;
  equivalentQuestionIds?: readonly (readonly string[])[];
  categoryChoiceMs?: number;
  rules?: FrozenMatchRules;
}
interface SelectionDependencies {
  ids: IdGenerator;
  random: RandomSource;
}
export type SelectionStart =
  | { status: 'ready'; selection: QuestionSelection }
  | { status: 'blocked'; reason: 'insufficient-content'; message: string };
/** Private, in-memory checkpoint. Never accept this object from a client or publish it. */
export interface SelectionCheckpoint {
  readonly data: object;
}
export type RoundSelectionView =
  | {
      status: 'choosing';
      roundId: RoundId;
      mode: SelectionMode;
      chooserPlayerId: PlayerId;
      categories: CategoryId[];
      deadlineAt: number;
    }
  | {
      status: 'selected' | 'complete';
      roundId: RoundId;
      mode: SelectionMode;
      category: CategoryId;
      selectedBy: 'player' | 'timeout';
      questionCount: number;
      completedQuestions: number;
    };
interface SelectionRound {
  roundId: RoundId;
  mode: SelectionMode;
  chooser: PlayerId;
  categories: CategoryId[];
  deadlineAt: number;
  chosen: null | { category: CategoryId; by: 'player' | 'timeout'; questions: ApprovedQuestion[] };
  prepared: Map<number, PreparedQuestion>;
  completed: number;
}
interface FinalSelection {
  roundId: RoundId;
  current: PreparedQuestion | null;
  completedIds: Set<QuestionId>;
  completed: number;
  seenCategories: Set<string>;
  categoryCounts: Map<string, number>;
}

/** Private selection, checkpointed with the match inside each room transaction. */
export class QuestionSelection {
  private readonly questions: ApprovedQuestion[];
  private readonly rounds = new Map<RoundId, SelectionRound>();
  private readonly claimed = new Set<string>();
  private readonly reservedFinal = new Set<string>();
  private readonly used = new Set<string>();
  private readonly issuedPublicIds = new Set<string>();
  private readonly editorialIds: Set<string>;
  private queue: ThemeChoiceQueue;
  private activeRound: SelectionRound | null = null;
  private final: FinalSelection | null = null;
  private interruption: ContentInterruption | null = null;
  private previousCategory: CategoryId | null = null;
  private completedRounds = 0;
  private readonly options: SelectionOptions;
  private readonly categoryChoiceMs: number;
  private readonly rules: FrozenMatchRules;
  private readonly policy: ReturnType<typeof selectionPolicy>;

  private constructor(
    repository: QuestionRepository,
    private readonly deps: SelectionDependencies,
    options: SelectionOptions,
  ) {
    this.options = structuredClone(options);
    try {
      if (options.rules && options.rules.matchId !== options.matchId)
        throw new SelectionError('invalid-config');
      const parameters = options.rules?.parameters ?? PROTOTYPE_PARAMETERS;
      if (
        options.rules &&
        options.categoryChoiceMs !== undefined &&
        options.categoryChoiceMs !== parameters.timings.categoryChoiceMs
      )
        throw new SelectionError('invalid-config');
      this.rules = freezeMatchRules(options.matchId, {
        ...parameters,
        timings: {
          ...parameters.timings,
          categoryChoiceMs: options.categoryChoiceMs ?? parameters.timings.categoryChoiceMs,
        },
      });
    } catch {
      throw new SelectionError('invalid-config');
    }
    this.policy = selectionPolicy(this.rules.parameters);
    this.categoryChoiceMs = this.rules.parameters.timings.categoryChoiceMs;
    if (
      !matchIdSchema.safeParse(options.matchId).success ||
      !['classic-prototype', 'full-prototype'].includes(options.format) ||
      options.players.some((id) => !playerIdSchema.safeParse(id).success) ||
      new Set(options.players).size !== options.players.length ||
      !options.enabledCategories.length ||
      options.enabledCategories.length > 32 ||
      options.enabledCategories.some((id) => !categoryIdSchema.safeParse(id).success) ||
      new Set(options.enabledCategories).size !== options.enabledCategories.length ||
      !Number.isSafeInteger(this.categoryChoiceMs) ||
      this.categoryChoiceMs < 1
    )
      throw new SelectionError('invalid-config');
    phaseDemand('classic', options.players.length, this.rules.parameters);
    this.questions = canonicalQuestions(
      repository.list(),
      options.equivalentQuestionIds ?? [],
      (q) =>
        q.type === 'multiple' &&
        options.enabledCategories.includes(categoryIdSchema.parse(q.category)),
    );
    this.editorialIds = new Set(
      this.questions.flatMap((q) => [q.id, ...q.options.map((o) => o.id)]),
    );
    this.queue = choiceQueue(options.players, deps.random, options.previousChoiceQueue);
  }

  static create(
    repository: QuestionRepository,
    deps: SelectionDependencies,
    options: SelectionOptions,
  ): SelectionStart {
    const selection = new QuestionSelection(repository, deps, options);
    const demands = selection.remainingDemands();
    const stock = stockOf(selection.questions);
    const reserve = options.format === 'full-prototype' ? selection.policy.finalReserve : undefined;
    const allocation = phaseAllocation(stock, demands, reserve);
    if (!allocation)
      return {
        status: 'blocked',
        reason: 'insufficient-content',
        message: 'Não há perguntas inéditas suficientes nos temas e dificuldades deste formato.',
      };
    if (reserve) selection.reserveForFinal(stock, demands, allocation);
    return { status: 'ready', selection };
  }

  /** Clone the entire graph together so activeRound and rounds keep their shared identity. */
  checkpoint(): SelectionCheckpoint {
    return { data: structuredClone({ ...this, deps: undefined }) };
  }

  /** Resume only a trusted checkpoint produced above; entropy stays outside the transaction. */
  static resume(checkpoint: SelectionCheckpoint, deps: SelectionDependencies): QuestionSelection {
    return Object.assign(
      Object.create(QuestionSelection.prototype) as QuestionSelection,
      structuredClone(checkpoint.data),
      { deps },
    );
  }

  /** Counts and editorial history are private diagnostics, never a client view. */
  availability(): { regular: Stock; finalReserve: Stock } {
    return {
      regular: stockOf(this.available()),
      finalReserve: stockOf(this.questions.filter((q) => this.reservedFinal.has(q.id))),
    };
  }
  history(): string[] {
    return [...this.used];
  }
  choiceQueueForRematch(): ThemeChoiceQueue {
    return structuredClone(this.queue);
  }
  status(): { status: 'active' } | ContentInterruption {
    return this.interruption ? { ...this.interruption } : { status: 'active' };
  }

  openRound(
    roundId: RoundId,
    mode: SelectionMode,
    now: number,
  ): RoundSelectionView | ContentInterruption {
    this.assertRoundId(roundId);
    this.assertTime(now);
    const existing = this.rounds.get(roundId);
    if (existing) {
      if (existing.mode !== mode) throw new SelectionError('stale-context');
      return this.view(existing);
    }
    if (this.interruption) return { ...this.interruption };
    if (this.final || (this.activeRound && !this.isComplete(this.activeRound)))
      throw new SelectionError('invalid-state');
    const expected = this.remainingModes()[0];
    if (mode !== expected) throw new SelectionError('invalid-state');
    const stock = stockOf(this.available());
    const demand = phaseDemand(mode, this.options.players.length, this.rules.parameters);
    const future = this.remainingDemands().slice(1);
    let eligible = Object.keys(stock)
      .sort()
      .filter((category) => {
        const counts = stock[category]!;
        if (!covers(counts, demand)) return false;
        return phaseAllocation({ ...stock, [category]: subtract(counts, demand) }, future) !== null;
      });
    if (eligible.some((category) => category !== this.previousCategory))
      eligible = eligible.filter((category) => category !== this.previousCategory);
    if (!eligible.length) return this.interrupt();
    const deadlineAt = now + this.categoryChoiceMs;
    this.assertTime(deadlineAt);
    const categories = shuffled(eligible, this.deps.random)
      .slice(0, this.policy.maximumCategoryOptions)
      .map((category) => categoryIdSchema.parse(category));
    const round: SelectionRound = {
      roundId,
      mode,
      categories,
      deadlineAt,
      chooser: nextChooser(this.queue),
      chosen: null,
      prepared: new Map(),
      completed: 0,
    };
    this.rounds.set(roundId, round);
    this.activeRound = round;
    return this.view(round);
  }

  chooseCategory(
    roundId: RoundId,
    playerId: PlayerId,
    category: CategoryId,
    now: number,
  ): RoundSelectionView {
    this.assertTime(now);
    const round = this.requireRound(roundId);
    if (playerId !== round.chooser) throw new SelectionError('forbidden');
    if (round.chosen) {
      if (round.chosen.category !== category) throw new SelectionError('invalid-state');
      return this.view(round);
    }
    if (now >= round.deadlineAt) throw new SelectionError('deadline-expired');
    if (!round.categories.includes(category)) throw new SelectionError('invalid-category');
    return this.select(round, category, 'player');
  }
  expireCategoryChoice(roundId: RoundId, now: number): RoundSelectionView | { status: 'ignored' } {
    this.assertTime(now);
    const round = this.activeRound;
    if (
      !round ||
      round.roundId !== roundId ||
      round.chosen ||
      now < round.deadlineAt ||
      this.interruption
    )
      return { status: 'ignored' };
    const category = round.categories[randomIndex(this.deps.random, round.categories.length)]!;
    return this.select(round, category, 'timeout');
  }

  /** Private answer mapping. Only publicQuestion may be projected before reveal. */
  currentQuestion(roundId: RoundId): PreparedQuestion | null {
    const round = this.requireRound(roundId);
    if (!round.chosen) throw new SelectionError('invalid-state');
    if (this.isComplete(round)) return null;
    let prepared = round.prepared.get(round.completed);
    if (!prepared) {
      const question = round.chosen.questions[round.completed]!;
      prepared = this.prepare(question);
      round.prepared.set(round.completed, prepared);
      this.used.add(question.id);
    }
    return structuredClone(prepared);
  }
  advanceQuestion(roundId: RoundId, questionId: QuestionId): RoundSelectionView {
    const round = this.requireRound(roundId);
    const current = round.prepared.get(round.completed);
    if (current?.publicQuestion.questionId !== questionId) {
      const alreadyCompleted = [...round.prepared.entries()].some(
        ([index, prepared]) =>
          index < round.completed && prepared.publicQuestion.questionId === questionId,
      );
      if (alreadyCompleted) return this.view(round);
      throw new SelectionError('stale-context');
    }
    round.completed++;
    if (this.isComplete(round)) this.completedRounds++;
    return this.view(round);
  }

  startFinal(roundId: RoundId) {
    this.assertRoundId(roundId);
    if (this.interruption) return { ...this.interruption };
    if (this.final) {
      if (this.final.roundId !== roundId) throw new SelectionError('stale-context');
      return { status: 'ready' as const, roundId };
    }
    if (
      this.options.format !== 'full-prototype' ||
      this.completedRounds !== this.policy.modes.length ||
      this.rounds.has(roundId)
    )
      throw new SelectionError('invalid-state');
    this.final = {
      roundId,
      current: null,
      completedIds: new Set(),
      completed: 0,
      seenCategories: new Set(),
      categoryCounts: new Map(),
    };
    return { status: 'ready' as const, roundId };
  }
  currentFinalQuestion(roundId: RoundId): PreparedQuestion | ContentInterruption {
    const final = this.requireFinal(roundId);
    if (this.interruption) return { ...this.interruption };
    if (final.current) return structuredClone(final.current);
    const difficulty = final.completed % 2 === 0 ? 'easy' : 'medium';
    const pool = this.reservedFinal.size
      ? this.questions.filter((q) => this.reservedFinal.has(q.id))
      : this.available();
    const eligible = pool.filter((q) => q.difficulty === difficulty);
    if (!eligible.length) return this.interrupt();
    const categories = [...new Set(eligible.map((q) => q.category))].sort();
    let choices = categories.filter((category) => !final.seenCategories.has(category));
    const restartCycle = !choices.length;
    if (restartCycle) choices = categories;
    const minimum = Math.min(...choices.map((category) => final.categoryCounts.get(category) ?? 0));
    choices = choices.filter((category) => (final.categoryCounts.get(category) ?? 0) === minimum);
    const category = choices[randomIndex(this.deps.random, choices.length)]!;
    const questions = eligible.filter((q) => q.category === category);
    const question = questions[randomIndex(this.deps.random, questions.length)]!;
    const prepared = this.prepare(question);
    if (restartCycle) final.seenCategories.clear();
    final.seenCategories.add(category);
    final.categoryCounts.set(category, (final.categoryCounts.get(category) ?? 0) + 1);
    final.current = prepared;
    this.reservedFinal.delete(question.id);
    this.claimed.add(question.id);
    this.used.add(question.id);
    return structuredClone(prepared);
  }
  advanceFinalQuestion(roundId: RoundId, questionId: QuestionId) {
    const final = this.requireFinal(roundId);
    if (final.completedIds.has(questionId)) return;
    if (this.interruption || final.current?.publicQuestion.questionId !== questionId)
      throw new SelectionError('stale-context');
    final.completedIds.add(questionId);
    final.current = null;
    final.completed++;
  }

  private remainingModes(): readonly SelectionMode[] {
    const modes =
      this.options.format === 'full-prototype' ? this.policy.modes : (['classic'] as const);
    return modes.slice(this.completedRounds);
  }
  private remainingDemands() {
    return this.remainingModes().map((mode) =>
      phaseDemand(mode, this.options.players.length, this.rules.parameters),
    );
  }
  private available() {
    return this.questions.filter((q) => !this.claimed.has(q.id) && !this.reservedFinal.has(q.id));
  }
  private reserveForFinal(
    stock: Stock,
    demands: readonly QuestionDemand[],
    allocation: readonly string[],
  ) {
    const spare = structuredClone(stock);
    for (const [index, category] of allocation.entries())
      spare[category] = subtract(spare[category]!, demands[index]!);
    const reservedCounts = new Map<string, number>();
    for (let i = 0; i < demandSize(this.policy.finalReserve); i++) {
      const difficulty: Difficulty = i % 2 === 0 ? 'easy' : 'medium';
      let categories = Object.keys(spare)
        .filter((category) => spare[category]![difficulty] > 0)
        .sort();
      const minimum = Math.min(...categories.map((category) => reservedCounts.get(category) ?? 0));
      categories = categories.filter((category) => (reservedCounts.get(category) ?? 0) === minimum);
      const category = categories[randomIndex(this.deps.random, categories.length)]!;
      const options = this.questions.filter(
        (q) =>
          q.category === category && q.difficulty === difficulty && !this.reservedFinal.has(q.id),
      );
      const question = options[randomIndex(this.deps.random, options.length)]!;
      this.reservedFinal.add(question.id);
      spare[category]![difficulty]--;
      reservedCounts.set(category, (reservedCounts.get(category) ?? 0) + 1);
    }
  }
  private select(
    round: SelectionRound,
    category: CategoryId,
    by: 'player' | 'timeout',
  ): RoundSelectionView {
    const demand = phaseDemand(round.mode, this.options.players.length, this.rules.parameters);
    const available = this.available().filter((q) => q.category === category);
    const questions = DIFFICULTIES.flatMap((difficulty) =>
      demand[difficulty] === 0
        ? []
        : shuffled(
            available.filter((q) => q.difficulty === difficulty),
            this.deps.random,
          ).slice(0, demand[difficulty]),
    );
    if (questions.length !== demandSize(demand)) throw new SelectionError('invalid-state');
    // Pressure follows its configured cycles; other modes mix the order.
    const byDifficulty = new Map(
      DIFFICULTIES.map((difficulty) => [
        difficulty,
        questions.filter((q) => q.difficulty === difficulty),
      ]),
    );
    const ordered =
      round.mode === 'pressure'
        ? this.rules.parameters.pressure.turnDifficulties.flatMap((difficulty) =>
            byDifficulty.get(difficulty)!.splice(0, this.options.players.length),
          )
        : shuffled(questions, this.deps.random);
    round.chosen = { category, by, questions: ordered };
    for (const question of questions) this.claimed.add(question.id);
    this.queue = advanceChoiceQueue(this.queue);
    this.previousCategory = category;
    return this.view(round);
  }
  private prepare(question: ApprovedQuestion): PreparedQuestion {
    const generated = new Set<string>();
    const nextId = () => {
      const id = this.deps.ids.next();
      if (generated.has(id) || this.issuedPublicIds.has(id) || this.editorialIds.has(id))
        throw new SelectionError('invalid-id');
      generated.add(id);
      return id;
    };
    const questionId = questionIdSchema.safeParse(nextId());
    if (!questionId.success) throw new SelectionError('invalid-id');
    const mapping = new Map<PreparedQuestion['correctOptionId'], string>();
    let correctOptionId: PreparedQuestion['correctOptionId'] | undefined;
    const options = shuffled(question.options, this.deps.random).map((option) => {
      const id = optionIdSchema.safeParse(nextId());
      if (!id.success) throw new SelectionError('invalid-id');
      mapping.set(id.data, option.id);
      if (option.id === question.correctOptionId) correctOptionId = id.data;
      return { optionId: id.data, text: option.text };
    });
    const publicQuestion = publicQuestionSchema.safeParse({
      questionId: questionId.data,
      category: question.category,
      locale: question.locale,
      prompt: question.prompt,
      difficulty: question.difficulty,
      type: question.type,
      options,
    });
    if (!publicQuestion.success || !correctOptionId) throw new SelectionError('invalid-catalog');
    const prepared: PreparedQuestion = {
      publicQuestion: publicQuestion.data,
      editorialQuestionId: question.id,
      editorialOptionByPublicId: mapping,
      correctOptionId,
      explanation: question.explanation ?? null,
    };
    for (const id of generated) this.issuedPublicIds.add(id);
    return prepared;
  }
  private view(round: SelectionRound): RoundSelectionView {
    if (!round.chosen)
      return {
        status: 'choosing',
        roundId: round.roundId,
        mode: round.mode,
        chooserPlayerId: round.chooser,
        categories: [...round.categories],
        deadlineAt: round.deadlineAt,
      };
    return {
      status: this.isComplete(round) ? 'complete' : 'selected',
      roundId: round.roundId,
      mode: round.mode,
      category: round.chosen.category,
      selectedBy: round.chosen.by,
      questionCount: round.chosen.questions.length,
      completedQuestions: round.completed,
    };
  }
  private isComplete(round: SelectionRound) {
    return round.chosen !== null && round.completed === round.chosen.questions.length;
  }
  private requireRound(roundId: RoundId): SelectionRound {
    if (this.interruption || this.final || this.activeRound?.roundId !== roundId)
      throw new SelectionError('stale-context');
    return this.activeRound;
  }
  private requireFinal(roundId: RoundId): FinalSelection {
    if (this.final?.roundId !== roundId) throw new SelectionError('stale-context');
    return this.final;
  }
  private interrupt(): ContentInterruption {
    this.interruption ??= contentInterruption();
    return { ...this.interruption };
  }
  private assertTime(now: number) {
    if (!Number.isSafeInteger(now) || now < 0) throw new SelectionError('invalid-config');
  }
  private assertRoundId(roundId: RoundId) {
    if (!roundIdSchema.safeParse(roundId).success) throw new SelectionError('invalid-config');
  }
}
