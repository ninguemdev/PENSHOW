import { describe, expect, it } from 'vitest';
import {
  avatarSchema,
  avatarLayerRect,
  avatarTransform,
  defaultAvatar,
  sanitizeAvatar,
  DEFAULT_AVATAR_TRANSFORM,
} from '../index.js';

const eyes = { x: 0.15, y: -0.1, scale: 1.5 };
describe('composição portátil de personagens', () => {
  it('lê perfis antigos com geometria original e conserva formato legado da cabeça', () => {
    const legacy = defaultAvatar();
    delete legacy.hair;
    const avatar = avatarSchema.parse({ ...legacy, head: 'head-cloud' });
    expect(avatarTransform(avatar, 'eyes')).toEqual(DEFAULT_AVATAR_TRANSFORM);
    expect(avatarTransform(avatar, 'head')).toEqual(DEFAULT_AVATAR_TRANSFORM);
    expect(sanitizeAvatar(avatar).head).toBe('head-cloud');
  });
  it('preserva cabelo e ajustes válidos no contrato público', () => {
    const avatar = {
      ...defaultAvatar(),
      hair: 'hair-tousled',
      layout: { version: 1, parts: { eyes } },
    };
    expect(avatarSchema.parse(avatar)).toEqual(avatar);
  });
  it.each([
    { version: 2, parts: { eyes } },
    { version: 1, parts: { head: eyes } },
    { version: 1, parts: { unknown: eyes } },
    { version: 1, parts: { eyes: { ...eyes, x: 0.351 } } },
    { version: 1, parts: { eyes: { ...eyes, y: -0.351 } } },
    { version: 1, parts: { eyes: { ...eyes, scale: 0 } } },
    { version: 1, parts: { eyes: { ...eyes, scale: 2.01 } } },
    { version: 1, parts: { eyes: { ...eyes, x: NaN } } },
    { version: 1, parts: { eyes: { ...eyes, scale: Infinity } } },
    { version: 1, parts: { eyes: { ...eyes, rotation: 90 } } },
  ])('recusa composição inválida na rede: %j', (layout) => {
    expect(avatarSchema.safeParse({ ...defaultAvatar(), layout }).success).toBe(false);
  });
  it('recupera localmente só os ajustes inválidos, sem perder peças ou outras categorias', () => {
    const avatar = sanitizeAvatar({
      ...defaultAvatar(),
      hair: 'hair-tousled',
      layout: {
        version: 1,
        parts: { eyes, mouth: { x: 8, y: 0, scale: 1 }, head: eyes },
      },
    });
    expect(avatar.layout).toEqual({ version: 1, parts: { eyes } });
    expect(avatar.hair).toBe('hair-tousled');
    expect(avatarTransform(avatar, 'mouth')).toEqual(DEFAULT_AVATAR_TRANSFORM);
    expect(
      sanitizeAvatar({ ...avatar, layout: { version: 99, parts: { eyes } } }).layout,
    ).toBeUndefined();
  });
  it('mantém o pivô da arte ao redimensionar e produz coordenadas proporcionais', () => {
    const pivot = { x: 0.4, y: 0.7 };
    const rect = avatarLayerRect(eyes, pivot);
    for (const size of [32, 64, 256]) {
      expect((rect.x + pivot.x * rect.width) * size).toBeCloseTo((pivot.x + eyes.x) * size);
      expect((rect.y + pivot.y * rect.height) * size).toBeCloseTo((pivot.y + eyes.y) * size);
      expect(rect.width * size).toBe(size * 1.5);
    }
  });
});
