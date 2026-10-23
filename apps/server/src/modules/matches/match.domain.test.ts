import { describe, expect, it, vi } from 'vitest';
import { playerIdSchema, roundIdSchema } from '@penshow/shared';
import {
  matchTimer,
  sameTimer,
  transitionMatch,
  createMatch,
  type MatchState,
} from './match.domain.js';
import { StrategyRegistry, classicStrategy } from './match-strategy.js';
import { freezeMatchRules } from '../scoring/match-rules.js';
import { resolveQuestion } from '../scoring/scoring.domain.js';
import {
  category,
  context,
  initial,
  players,
  prepared,
  reading,
  registry,
  roster,
  round,
  step,
  uuid,
} from '../../test-support/match.js';

function open() {
  const state = reading();
  return step(state, { kind: 'timer', timer: matchTimer(state)! }, 4000).state;
}
function answer(state: MatchState, playerId = players[0]!, now = 4000) {
  return step(
    state,
    {
      kind: 'answer',
      ...context(),
      playerId,
      questionId: prepared().publicQuestion.questionId,
      optionId: prepared().correctOptionId,
    },
    now,
  );
}
function expire(state: MatchState) {
  const timer = matchTimer(state)!;
  return step(state, { kind: 'timer', timer }, timer.deadlineAt);
}

describe('motor puro de partida', () => {
  it('reserva a gravação inteira antes de aceitar respostas e mantém a janela de resposta completa', () => {
    const waiting = step(category(), {
      kind: 'choose-category',
      ...context(),
      playerId: players[0]!,
      category: 'history',
    }).state;
    const question = { ...prepared(), narration: { durationMs: 7000 } };
    const state = step(waiting, { kind: 'question-prepared', question }).state;
    expect(state.stage).toMatchObject({ phase: 'question-reading', opensAt: 9500 });
    expect(() => answer(state, players[0]!, 4000)).toThrow();
    const opened = expire(state).state;
    expect(opened.stage).toMatchObject({
      phase: 'question-open',
      opensAt: 9500,
      deadlineAt: 24500,
    });
  });
  it('avança para a próxima estratégia registrada sem escolher modalidade no transporte', () => {
    // The speed fixture exercises dispatch only; it is not installed by MatchService.
    const resolve = vi.fn((...args: Parameters<typeof classicStrategy.resolve>) =>
      resolveQuestion(args[0], args[1], args[2], { mode: 'speed', answers: args[3] }),
    );
    const strategies = new StrategyRegistry([classicStrategy, { mode: 'speed', resolve }]);
    let state = createMatch(
      roster,
      freezeMatchRules(roster.matchId),
      [round, { mode: 'speed', index: 2, roundId: roundIdSchema.parse(uuid(201)) }],
      strategies,
    );
    state.stage = { phase: 'round-results', deadlineAt: 2000 };
    const apply = (event: Parameters<typeof transitionMatch>[1], now = 2000) => {
      state = transitionMatch(state, event, now, strategies).state;
    };
    apply({ kind: 'timer', timer: matchTimer(state)! });
    expect(state.roundIndex).toBe(1);
    expect(state.stage.phase).toBe('instructions');
    for (const playerId of players) apply({ kind: 'ready', ...context(state), playerId });
    apply({
      kind: 'category-offered',
      offer: {
        status: 'choosing',
        roundId: state.rounds[1]!.roundId,
        mode: 'speed',
        chooserPlayerId: players[0]!,
        categories: ['history'],
        deadlineAt: 12000,
      },
    });
    apply({
      kind: 'choose-category',
      ...context(state),
      playerId: players[0]!,
      category: 'history',
    });
    apply({ kind: 'question-prepared', question: prepared() });
    apply({ kind: 'timer', timer: matchTimer(state)! }, 5000);
    apply({ kind: 'timer', timer: matchTimer(state)! }, 20000);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(state.history[0]!.mode).toBe('speed');
  });
  it('congela entradas por cópia e reproduz a mesma transição sem alterar o agregado anterior', () => {
    const state = initial(),
      before = structuredClone(state);
    const event = { kind: 'ready' as const, ...context(), playerId: players[0]! };
    expect(step(state, event)).toEqual(step(state, event));
    expect(state).toEqual(before);
    const source = structuredClone(roster),
      plan = [structuredClone(round)];
    const match = createMatch(source, freezeMatchRules(source.matchId), plan, registry);
    source.players[0]!.profile.nickname = 'Alterado';
    plan[0]!.roundId = roundIdSchema.parse(uuid(201));
    expect(match.roster.players[0]!.profile.nickname).toBe('Ana');
    expect(match.rounds[0]).toEqual(round);
    expect(Object.isFrozen(match.rules.parameters)).toBe(true);
  });
  it('confirma prontos uma vez e solicita temas quando todos estão prontos', () => {
    const first = step(initial(), { kind: 'ready', ...context(), playerId: players[0]! });
    expect(first.state.stage.phase).toBe('instructions');
    expect(step(first.state, { kind: 'ready', ...context(), playerId: players[0]! }).changed).toBe(
      false,
    );
    const second = step(first.state, { kind: 'ready', ...context(), playerId: players[1]! });
    expect(second.effects).toEqual([{ kind: 'offer-categories' }]);
    expect(second.state.stage.phase).toBe('awaiting-category');
  });
  it('encerra instruções também por prazo e rejeita prontidão no prazo exato', () => {
    const state = initial(),
      timer = matchTimer(state)!;
    expect(() =>
      step(state, { kind: 'ready', ...context(), playerId: players[0]! }, timer.deadlineAt),
    ).toThrowError('DEADLINE_EXPIRED');
    expect(expire(state).effects).toEqual([{ kind: 'offer-categories' }]);
  });
  it('rejeita contexto antigo, espectador e ação fora da etapa', () => {
    expect(() =>
      step(initial(), {
        kind: 'ready',
        ...context(),
        roundId: roundIdSchema.parse(uuid(999)),
        playerId: players[0]!,
      }),
    ).toThrowError('STALE_CONTEXT');
    expect(() =>
      step(initial(), { kind: 'ready', ...context(), playerId: playerIdSchema.parse(uuid(99)) }),
    ).toThrowError('FORBIDDEN');
    expect(() => answer(reading())).toThrowError('INVALID_PHASE');
  });
  it('valida dono do tema, oferta e prazo, preservando a ordem dos efeitos', () => {
    const state = category();
    const event = {
      kind: 'choose-category' as const,
      ...context(),
      playerId: players[0]!,
      category: 'history',
    };
    expect(() => step(state, { ...event, playerId: players[1]! })).toThrowError('FORBIDDEN');
    expect(() => step(state, { ...event, category: 'unknown' })).toThrowError('INVALID_PAYLOAD');
    expect(() => step(state, event, 11000)).toThrowError('DEADLINE_EXPIRED');
    expect(step(state, event).effects.map((effect) => effect.kind)).toEqual([
      'select-category',
      'next-question',
    ]);
    expect(expire(state).effects.map((effect) => effect.kind)).toEqual([
      'expire-category',
      'next-question',
    ]);
  });
  it('abre somente no horário anunciado e mantém a janela se o callback atrasa', () => {
    const state = reading(),
      timer = matchTimer(state)!;
    expect(step(state, { kind: 'timer', timer }, 3999).changed).toBe(false);
    expect(step(state, { kind: 'timer', timer }, 5000).state.stage).toMatchObject({
      phase: 'question-open',
      opensAt: 4000,
      deadlineAt: 19000,
    });
    const expired = step(state, { kind: 'timer', timer }, 20000).state;
    expect(expired.stage.phase).toBe('reveal');
    expect(expired.scoreboard.map((entry) => entry.points)).toEqual([0, 0]);
  });
  it('aceita uma resposta por jogador e só calcula quando todos respondem', () => {
    const first = answer(open());
    expect(first.state.scoreboard.map((entry) => entry.points)).toEqual([0, 0]);
    expect(() => answer(first.state)).toThrowError('ALREADY_ANSWERED');
    const second = answer(first.state, players[1]!);
    expect(second.state.stage.phase).toBe('reveal');
    expect(second.state.scoreboard.map((entry) => entry.points)).toEqual([100, 100]);
    expect(second.state.history).toHaveLength(1);
    expect(() => answer(second.state)).toThrowError('INVALID_PHASE');
    expect(matchTimer(second.state)?.deadlineAt).toBe(9000);
  });
  it('aceita um milissegundo antes e rejeita no prazo exato sem pontuar o ausente', () => {
    const state = answer(open(), players[0]!, 18999).state;
    expect(() => answer(state, players[1]!, 19000)).toThrowError('DEADLINE_EXPIRED');
    const revealed = expire(state).state;
    expect(revealed.scoreboard.map((entry) => entry.points)).toEqual([100, 0]);
  });
  it('rejeita alternativa de outra pergunta sem alterar respostas', () => {
    const state = open();
    expect(() =>
      step(
        state,
        {
          kind: 'answer',
          ...context(),
          playerId: players[0]!,
          questionId: prepared().publicQuestion.questionId,
          optionId: prepared(500).correctOptionId,
        },
        4000,
      ),
    ).toThrowError('INVALID_PAYLOAD');
    expect(state.stage).toMatchObject({ answers: [] });
  });
  it.each(['matchId', 'roundId', 'questionId', 'revision', 'phase', 'deadlineAt'] as const)(
    'ignora timer com %s divergente',
    (key) => {
      const state = open(),
        timer = matchTimer(state)!;
      const stale = {
        ...timer,
        [key]: typeof timer[key] === 'number' ? Number(timer[key]) + 1 : uuid(999),
      };
      expect(
        transitionMatch(state, { kind: 'timer', timer: stale as typeof timer }, 19000, registry)
          .changed,
      ).toBe(false);
      expect(sameTimer(timer, stale as typeof timer)).toBe(false);
    },
  );
  it('não reaplica placar quando um timer cancelado ou repetido chega depois da revelação', () => {
    const state = answer(open()).state,
      timer = matchTimer(state)!;
    const revealed = step(state, { kind: 'timer', timer }, timer.deadlineAt).state;
    expect(step(revealed, { kind: 'timer', timer }, timer.deadlineAt).changed).toBe(false);
    expect(revealed.history).toHaveLength(1);
  });
  it('agenda próxima pergunta, resultado e conclusão explícita do protótipo', () => {
    const revealed = expire(open()).state;
    const next = expire(revealed);
    expect(next.effects).toEqual([
      { kind: 'next-question', previousQuestionId: prepared().publicQuestion.questionId },
    ]);
    const results = step(next.state, { kind: 'question-prepared', question: null }, 24000).state;
    expect(results.stage).toMatchObject({ phase: 'round-results', deadlineAt: 32000 });
    const complete = expire(results).state;
    expect(complete.stage.phase).toBe('prototype-complete');
    expect(matchTimer(complete)).toBeNull();
    expect(step(complete, { kind: 'timer', timer: matchTimer(results)! }, 33000).changed).toBe(
      false,
    );
    expect(() => answer(complete)).toThrowError('INVALID_PHASE');
  });
  it('interrompe sem timer e não reutiliza pergunta concluída', () => {
    const revealed = expire(open()).state,
      awaiting = expire(revealed).state;
    expect(() => step(awaiting, { kind: 'question-prepared', question: prepared() })).toThrowError(
      'STALE_CONTEXT',
    );
    const interrupted = step(awaiting, {
      kind: 'interrupt',
      reason: 'insufficient-questions',
    }).state;
    expect(matchTimer(interrupted)).toBeNull();
    expect(step(interrupted, { kind: 'interrupt', reason: 'room-closed' }).changed).toBe(false);
  });
  it('despacha pelo registro e rejeita modalidade ausente ou duplicada', () => {
    expect(() =>
      createMatch(
        roster,
        freezeMatchRules(roster.matchId),
        [{ mode: 'speed', index: 2, roundId: round.roundId }],
        registry,
      ),
    ).toThrow('não implementada');
    expect(() => new StrategyRegistry([classicStrategy, classicStrategy])).toThrow('duplicada');
    const resolve = vi.fn(classicStrategy.resolve),
      strategies = new StrategyRegistry([{ mode: 'classic', resolve }]);
    transitionMatch(open(), { kind: 'timer', timer: matchTimer(open())! }, 19000, strategies);
    expect(resolve).toHaveBeenCalledTimes(1);
  });
  it('mantém o agregado original se a estratégia falha', () => {
    const state = answer(open()).state,
      original = structuredClone(state);
    const strategies = new StrategyRegistry([
      {
        mode: 'classic',
        resolve: () => {
          throw new Error('Falha simulada');
        },
      },
    ]);
    expect(() =>
      transitionMatch(state, { kind: 'timer', timer: matchTimer(state)! }, 19000, strategies),
    ).toThrow('Falha simulada');
    expect(state).toEqual(original);
    expect(expire(state).state.scoreboard.map((entry) => entry.points)).toEqual([100, 0]);
  });
});
