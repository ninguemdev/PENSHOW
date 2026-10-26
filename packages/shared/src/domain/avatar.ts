// Adapted from Comicle, MIT (2026 Dionel Sebastião de Morais). See THIRD_PARTY_NOTICES.md.
import type { AvatarLayout } from '../avatar/layout.js';
/** Avatar categories in drawing order, bottom to top (docs/avatares.md §1). */
export const AVATAR_CATEGORIES = [
  'head',
  'cheeks',
  'eyes',
  'mouth',
  'faceAccessory',
  'hair',
  'hat',
] as const;

export const REQUIRED_AVATAR_CATEGORIES = ['head', 'eyes', 'mouth'] as const;
export const OPTIONAL_AVATAR_CATEGORIES = ['cheeks', 'faceAccessory', 'hair', 'hat'] as const;

export type AvatarCategory = (typeof AVATAR_CATEGORIES)[number];
export type RequiredAvatarCategory = (typeof REQUIRED_AVATAR_CATEGORIES)[number];
export type OptionalAvatarCategory = (typeof OPTIONAL_AVATAR_CATEGORIES)[number];

/** Catalog option IDs; optional categories use null for no selection. */
export interface AvatarConfig {
  head: string;
  eyes: string;
  mouth: string;
  cheeks: string | null;
  hat: string | null;
  faceAccessory: string | null;
  hair?: string | null | undefined;
  layout?: AvatarLayout | undefined;
}

export interface AvatarRandom {
  integer(maxExclusive: number): number;
}
