import { describe, expect, it } from 'vitest';
import { tiebreakInputSchema, tiebreakFrameSchema } from './schemas/tiebreak.js';

const uuid = (n: number) => `90000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const input = {
  tiebreakId: uuid(1),
  bout: 1,
  generation: 0,
  sequence: 1,
  moveX: 0,
  moveY: 1,
  aimX: 1,
  aimY: 0,
  shooting: true,
};
describe('fronteira pública do combate', () => {
  it('recebe somente intenções, sem aceitar posição, dano ou vidas do cliente', () => {
    expect(tiebreakInputSchema.safeParse(input).success).toBe(true);
    for (const field of ['x', 'y', 'damage', 'lives', 'targetPlayerId'])
      expect(tiebreakInputSchema.safeParse({ ...input, [field]: 1 }).success).toBe(false);
  });
  it.each([NaN, Infinity, -Infinity, 1.001])('recusa eixo fora do domínio: %s', (value) => {
    expect(tiebreakInputSchema.safeParse({ ...input, moveX: value }).success).toBe(false);
  });
  it('não admite vidas incompatíveis com o estado nem projéteis de outro participante', () => {
    const fighter = (id: number) => ({
      playerId: uuid(id),
      x: 100 * id,
      y: 400,
      aimX: 1,
      aimY: 0,
      lives: 3,
      status: 'fighting',
      protected: false,
    });
    const frame = {
      tiebreakId: uuid(1),
      bout: 1,
      generation: 0,
      tick: 1,
      serverNow: 1000,
      fighters: [fighter(2), fighter(3)],
      projectiles: [],
    };
    expect(tiebreakFrameSchema.safeParse(frame).success).toBe(true);
    expect(
      tiebreakFrameSchema.safeParse({
        ...frame,
        fighters: [{ ...fighter(2), lives: 0 }, fighter(3)],
      }).success,
    ).toBe(false);
    expect(
      tiebreakFrameSchema.safeParse({
        ...frame,
        projectiles: [{ id: 1, ownerId: uuid(4), x: 0, y: 0 }],
      }).success,
    ).toBe(false);
    expect(
      tiebreakFrameSchema.safeParse({ ...frame, fighters: [fighter(2), fighter(2)] }).success,
    ).toBe(false);
  });
});
