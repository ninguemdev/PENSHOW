import { describe, expect, it } from 'vitest';
import { matchViewSchema } from './schemas/view.js';
import { roomSettingsSchema } from './schemas/settings.js';

const id = (n: number) => `36000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const plan = ['wager', 'pressure', 'classic', 'speed', 'final'].map((mode, index) => ({
  roundId: id(index + 10),
  index: index + 1,
  mode,
  ...(mode === 'pressure'
    ? { variant: { status: 'confirmed', decisionId: 'D04', mode: 'dynamite' } }
    : {}),
}));
const view = {
  matchId: id(1),
  rulesVersion: 'prototype-v1',
  format: 'classic',
  plan,
  progress: { roundNumber: 3, roundCount: 5, questionNumber: 0, questionCount: 6 },
  scoreboard: [2, 3].map((n) => ({ playerId: id(n), points: 0, correctAnswers: 0 })),
  stage: { phase: 'instructions', round: plan[2], readyPlayerIds: [], deadlineAt: 16000 },
};

describe('contrato do modo clássico completo', () => {
  it('cria preferências com o modo clássico por padrão', () => {
    expect(roomSettingsSchema.parse({ maxPlayers: 2, enabledCategories: ['history'] }).format).toBe(
      'classic',
    );
  });
  it('aceita quiz simples na terceira posição e final fixa na quinta', () => {
    expect(matchViewSchema.safeParse(view).success).toBe(true);
  });
  it.each([
    { ...view, plan: undefined },
    { ...view, plan: plan.slice(1) },
    { ...view, plan: [plan[0], plan[0], ...plan.slice(2)] },
    {
      ...view,
      plan: plan.map((round, index) => (index === 3 ? { ...round, mode: 'wager' } : round)),
    },
    { ...view, plan: plan.toReversed() },
    { ...view, format: 'isolated-prototype' },
    { ...view, progress: { ...view.progress, roundCount: 4 } },
    { ...view, stage: { ...view.stage, round: { ...plan[2], roundId: id(99) } } },
  ])('recusa plano ausente, repetido, reordenado ou divergente da fase: %#', (invalid) => {
    expect(matchViewSchema.safeParse(invalid).success).toBe(false);
  });
});
