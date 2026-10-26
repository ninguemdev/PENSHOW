// Adapted from Comicle, MIT (2026 Dionel Sebastião de Morais). See THIRD_PARTY_NOTICES.md.
import { z } from 'zod';

import {
  AVATAR_CATEGORIES,
  type AvatarRandom,
  REQUIRED_AVATAR_CATEGORIES,
  type AvatarCategory,
  type AvatarConfig,
  type OptionalAvatarCategory,
  type RequiredAvatarCategory,
} from '../domain/avatar.js';
import catalogJson from './catalog.json' with { type: 'json' };
import { avatarLayoutSchema, sanitizeAvatarLayout } from './layout.js';

// Catalog format and rules: docs/avatares.md §2.

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const requiredCategories: ReadonlySet<AvatarCategory> = new Set(REQUIRED_AVATAR_CATEGORIES);

function isRequiredCategory(category: AvatarCategory): category is RequiredAvatarCategory {
  return requiredCategories.has(category);
}

/** `faceAccessory` → `face-accessory`: prefix of the category's IDs and name of its art folder. */
export function avatarCategorySlug(category: AvatarCategory): string {
  return category.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const optionSchema = z.strictObject({
  id: z.string().max(64).regex(KEBAB_CASE),
  label: z.string().min(1),
  /** Relative to apps/web/public/avatars/. */
  file: z.string().min(1),
  /** Hidden from the picker but still rendered for profiles that use it. */
  retired: z.boolean().optional(),
  pivot: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});

const categorySchema = z.strictObject({
  label: z.string().min(1),
  required: z.boolean(),
  options: z.array(optionSchema),
});

export const avatarCatalogSchema = z
  .strictObject({
    version: z.literal(1),
    categories: z.strictObject({
      head: categorySchema,
      cheeks: categorySchema,
      eyes: categorySchema,
      mouth: categorySchema,
      faceAccessory: categorySchema,
      hat: categorySchema,
      hair: categorySchema,
    }),
  })
  .superRefine((catalog, ctx) => {
    const seenIds = new Set<string>();
    for (const category of AVATAR_CATEGORIES) {
      const { required, options } = catalog.categories[category];
      const path = ['categories', category];
      if (required !== isRequiredCategory(category)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'required'],
          message: `"required" de ${category} não corresponde às categorias do PENSHOW`,
        });
      }
      if (isRequiredCategory(category) && !options.some((option) => !option.retired)) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'options'],
          message: `${category} precisa de ao menos uma opção ativa`,
        });
      }
      const prefix = `${avatarCategorySlug(category)}-`;
      for (const option of options) {
        if (option.file !== `${avatarCategorySlug(category)}/${option.id}.png`) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, 'options'],
            message: 'A arte precisa usar o caminho PNG local da própria categoria e ID.',
          });
        }
        if (!option.id.startsWith(prefix)) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, 'options'],
            message: `o id ${option.id} deve começar com "${prefix}"`,
          });
        }
        if (seenIds.has(option.id)) {
          ctx.addIssue({
            code: 'custom',
            path: [...path, 'options'],
            message: `id duplicado: ${option.id}`,
          });
        }
        seenIds.add(option.id);
      }
    }
  });

export type AvatarCatalog = z.infer<typeof avatarCatalogSchema>;
export type AvatarOption = z.infer<typeof optionSchema>;

export const avatarCatalog: AvatarCatalog = avatarCatalogSchema.parse(catalogJson);

/** Options shown in the picker (non-retired). */
export function activeOptions(category: AvatarCategory): AvatarOption[] {
  return avatarCatalog.categories[category].options.filter((option) => !option.retired);
}

/** Any option of the category, retired ones included (they still render for saved profiles). */
export function findAvatarOption(category: AvatarCategory, id: string): AvatarOption | undefined {
  return avatarCatalog.categories[category].options.find((option) => option.id === id);
}

/** Retired IDs stay valid so saved profiles keep rendering. */
export function isValidOptionId(category: AvatarCategory, id: string): boolean {
  return findAvatarOption(category, id) !== undefined;
}

function isValidOptional(category: OptionalAvatarCategory, value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && isValidOptionId(category, value));
}

function isValidRequired(category: RequiredAvatarCategory, value: unknown): value is string {
  return typeof value === 'string' && isValidOptionId(category, value);
}

/** Every category holds one of its own IDs; only optional categories accept null. */
export function isValidAvatar(avatar: AvatarConfig): boolean {
  return (
    isValidRequired('head', avatar.head) &&
    isValidRequired('eyes', avatar.eyes) &&
    isValidRequired('mouth', avatar.mouth) &&
    isValidOptional('cheeks', avatar.cheeks) &&
    isValidOptional('hat', avatar.hat) &&
    isValidOptional('faceAccessory', avatar.faceAccessory) &&
    (avatar.hair === undefined || isValidOptional('hair', avatar.hair)) &&
    (avatar.layout === undefined || avatarLayoutSchema.safeParse(avatar.layout).success)
  );
}

function defaultFor(category: RequiredAvatarCategory): string {
  const [first] = activeOptions(category);
  if (!first) {
    // Unreachable: the catalog schema requires an active option in every required category.
    throw new Error(`Catálogo sem opção ativa para ${category}`);
  }
  return first.id;
}

/** First active option of each required category; `null` for optional ones. */
export function defaultAvatar(): AvatarConfig {
  return {
    head: defaultFor('head'),
    eyes: defaultFor('eyes'),
    mouth: defaultFor('mouth'),
    cheeks: null,
    hat: null,
    faceAccessory: null,
    hair: null,
  };
}

function pick<T>(rng: AvatarRandom, items: readonly T[]): T {
  const item = items[rng.integer(items.length)];
  if (item === undefined) {
    throw new RangeError('AvatarRandom.integer devolveu um índice fora do intervalo');
  }
  return item;
}

function randomRequired(rng: AvatarRandom, category: RequiredAvatarCategory): string {
  return pick(rng, activeOptions(category)).id;
}

function randomOptional(rng: AvatarRandom, category: OptionalAvatarCategory): string | null {
  return pick<string | null>(rng, [null, ...activeOptions(category).map((option) => option.id)]);
}

/** Random avatar among active options; optional categories may come out as `null`. */
export function randomAvatar(rng: AvatarRandom): AvatarConfig {
  return {
    head: defaultFor('head'),
    eyes: randomRequired(rng, 'eyes'),
    mouth: randomRequired(rng, 'mouth'),
    cheeks: randomOptional(rng, 'cheeks'),
    hat: randomOptional(rng, 'hat'),
    faceAccessory: randomOptional(rng, 'faceAccessory'),
    hair: randomOptional(rng, 'hair'),
  };
}

/**
 * Replaces only invalid categories of a saved avatar with their defaults.
 * Accepts anything, since it reads data saved by older versions of the client.
 */
export function sanitizeAvatar(value: unknown): AvatarConfig {
  const saved = new Map<string, unknown>(
    typeof value === 'object' && value !== null ? Object.entries(value) : [],
  );
  const fallback = defaultAvatar();
  const required = (category: RequiredAvatarCategory): string => {
    const candidate = saved.get(category);
    return isValidRequired(category, candidate) ? candidate : fallback[category];
  };
  const optional = (category: OptionalAvatarCategory): string | null => {
    const candidate = saved.get(category);
    return isValidOptional(category, candidate) ? candidate : (fallback[category] ?? null);
  };
  const layout = sanitizeAvatarLayout(saved.get('layout'));
  return {
    ...(layout ? { layout } : {}),
    hair: optional('hair'),
    head: required('head'),
    eyes: required('eyes'),
    mouth: required('mouth'),
    cheeks: optional('cheeks'),
    hat: optional('hat'),
    faceAccessory: optional('faceAccessory'),
  };
}
