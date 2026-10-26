import { describe, expect, it } from 'vitest';
import { type TiebreakFrame } from '@penshow/shared';
import { combatStage, finalView, finalRound } from '../test/final-fixtures';
import { hostId, matchId, question } from '../test/match-fixtures';
import { createRoomStore } from './room-store';

function setup() {
  const store = createRoomStore(),
    stage = combatStage(),
    view = finalView(stage, 2);
  store.getState().listen();
  expect(store.getState().receive(view, hostId)).toBe(true);
  const payload = (frame: TiebreakFrame) => ({
    roomId: view.roomId,
    matchId,
    roundId: finalRound.roundId,
    frame,
  });
  return { store, stage, view, payload };
}
describe('quadros de combate independentes da visão confiável', () => {
  it('ignora quadros anteriores à sala, repetidos, de outra geração ou combate', () => {
    const { store, stage, payload } = setup();
    const frame = { ...stage.tiebreak.frame, tick: 100 };
    expect(store.getState().receiveCombat(payload(frame))).toBe(true);
    expect(store.getState().receiveCombat(payload(frame))).toBe(false);
    expect(store.getState().receiveCombat(payload({ ...frame, tick: 99 }))).toBe(false);
    expect(store.getState().receiveCombat(payload({ ...frame, tick: 101, generation: 0 }))).toBe(
      false,
    );
    expect(store.getState().receiveCombat(payload({ ...frame, tick: 101, bout: 2 }))).toBe(false);
    store.getState().reset();
    expect(store.getState().receiveCombat(payload({ ...frame, tick: 102 }))).toBe(false);
    expect(store.getState().combatFrame).toBeNull();
  });
  it('quadro com tick alto não impede pergunta confiável com versão de sala menor', () => {
    const { store, stage, payload } = setup();
    expect(store.getState().receiveCombat(payload({ ...stage.tiebreak.frame, tick: 500 }))).toBe(
      true,
    );
    const asking = {
      ...stage,
      tiebreak: {
        ...stage.tiebreak,
        phase: 'questions' as const,
        ownQuestion: {
          status: 'open' as const,
          question: question(),
          opensAt: 1000,
          deadlineAt: 16000,
          submitted: false,
        },
      },
    };
    expect(store.getState().receive(finalView(asking, 3), hostId)).toBe(true);
    expect(store.getState().view?.state).toMatchObject({
      status: 'match',
      match: { stage: { tiebreak: { phase: 'questions', ownQuestion: { status: 'open' } } } },
    });
    expect(store.getState().receiveCombat(payload({ ...stage.tiebreak.frame, tick: 501 }))).toBe(
      false,
    );
  });
  it('visão completa atrasada no mesmo combate não faz as posições regredirem', () => {
    const { store, stage, payload } = setup();
    const frame = { ...stage.tiebreak.frame, tick: 50 };
    store.getState().receiveCombat(payload(frame));
    expect(store.getState().receive(finalView(stage, 3), hostId)).toBe(true);
    expect(store.getState().combatFrame?.tick).toBe(50);
  });
});
