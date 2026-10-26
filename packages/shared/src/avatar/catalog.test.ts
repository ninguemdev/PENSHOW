import { describe, expect, it } from 'vitest';
import {
  activeOptions,
  avatarCatalog,
  avatarCatalogSchema,
  avatarSchema,
  defaultAvatar,
  findAvatarOption,
  playerProfileSchema,
  randomAvatar,
  sanitizeAvatar,
} from '../index.js';

describe('catálogo de personagens', () => {
  it('sorteia com dependência explícita, incluindo ausência de acessórios', () => {
    expect(randomAvatar({ integer: () => 0 })).toEqual(defaultAvatar());
    expect(randomAvatar({ integer: (max) => max - 1 })).toEqual({
      head: 'head-round',
      eyes: 'eyes-suspicious',
      mouth: 'mouth-zigzag-nervous',
      cheeks: 'cheeks-whisker-lines',
      faceAccessory: 'face-accessory-disguise-glasses',
      hat: 'hat-propeller',
      hair: 'hair-tousled',
    });
  });
  it.each([-1, 1000, 0.5, NaN])('recusa RNG com índice inválido %s', (index) => {
    expect(() => randomAvatar({ integer: () => index })).toThrow(RangeError);
  });
  it('saneia apenas peças inválidas ou ausentes e preserva as válidas', () => {
    expect(
      sanitizeAvatar({
        head: 'removed',
        eyes: 'eyes-happy',
        mouth: 'head-cloud',
        hat: 'hat-crown',
        cheeks: null,
        faceAccessory: '../secret',
      }),
    ).toEqual({ ...defaultAvatar(), eyes: 'eyes-happy', hat: 'hat-crown' });
    expect(sanitizeAvatar(null)).toEqual(defaultAvatar());
    expect(sanitizeAvatar(['head-cloud'])).toEqual(defaultAvatar());
  });
  it('mantém peças aposentadas válidas para leitura, sem sorteá-las ou oferecê-las', () => {
    const option = avatarCatalog.categories.head.options[0]!;
    option.retired = true;
    try {
      expect(activeOptions('head').some((item) => item.id === option.id)).toBe(false);
      expect(randomAvatar({ integer: () => 0 }).head).toBe('head-square');
      expect(findAvatarOption('head', option.id)).toBe(option);
      expect(avatarSchema.safeParse({ ...defaultAvatar(), head: option.id }).success).toBe(true);
      expect(sanitizeAvatar({ ...defaultAvatar(), head: option.id }).head).toBe(option.id);
    } finally {
      delete option.retired;
    }
  });
  it.each(['head-missing', 'eyes-happy', '../head-round', 'https://host/head-round.png'])(
    'recusa peça desconhecida ou da categoria errada no protocolo: %s',
    (head) => {
      expect(
        playerProfileSchema.safeParse({ nickname: 'Ana', avatar: { ...defaultAvatar(), head } })
          .success,
      ).toBe(false);
    },
  );
  it.each([
    '../outside.png',
    '/avatars/head.png',
    'https://host/head.png',
    'head/head-round.svg',
    'head/%2e%2e.png',
  ])('recusa caminho de arte inseguro ou não suportado: %s', (file) => {
    const catalog = structuredClone(avatarCatalog);
    catalog.categories.head.options[0]!.file = file;
    expect(avatarCatalogSchema.safeParse(catalog).success).toBe(false);
  });
  it('rejeita duplicatas, categorias obrigatórias vazias e campos desconhecidos', () => {
    const longId = structuredClone(avatarCatalog);
    const part = longId.categories.head.options[0]!;
    part.id = `head-${'a'.repeat(64)}`;
    part.file = `head/${part.id}.png`;
    expect(avatarCatalogSchema.safeParse(longId).success).toBe(false);
    const catalog = structuredClone(avatarCatalog);
    catalog.categories.head.options.push(catalog.categories.head.options[0]!);
    expect(avatarCatalogSchema.safeParse(catalog).success).toBe(false);
    catalog.categories.head.options = [];
    expect(avatarCatalogSchema.safeParse(catalog).success).toBe(false);
    expect(avatarCatalogSchema.safeParse({ ...avatarCatalog, script: 'unexpected' }).success).toBe(
      false,
    );
  });
});
