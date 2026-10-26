import { createStore } from 'zustand/vanilla';
import {
  avatarSchema,
  defaultAvatar,
  nicknameSchema,
  playerProfileSchema,
  randomAvatar,
  sanitizeAvatar,
  isValidOptionId,
  OPTIONAL_AVATAR_CATEGORIES,
  EDITABLE_AVATAR_CATEGORIES,
  avatarTransformSchema,
  type EditableAvatarCategory,
  type AvatarTransform,
  type Avatar,
  type AvatarCategory,
  type AvatarRandom,
  type PlayerProfile,
} from '@penshow/shared';
import { z } from 'zod';
import { avatarRandom } from '../lib/avatar-random';
import { readStored, writeStored, type StorageAccess, type StorageIssue } from '../lib/storage';

export const PROFILE_STORAGE_KEY = 'penshow.profile';
const storedProfileSchema = z
  .strictObject({ nickname: nicknameSchema, avatar: z.unknown() })
  .transform((saved) => ({
    profile: { nickname: saved.nickname, avatar: sanitizeAvatar(saved.avatar) },
    recovered: !avatarSchema.safeParse(saved.avatar).success,
  }));

export function createProfileStore(storage: StorageAccess, rng: AvatarRandom = avatarRandom) {
  return createStore<{
    profile: PlayerProfile | null;
    storageIssue: StorageIssue;
    draft: { nickname: string; avatar: Avatar };
    hydrated: boolean;
    recovered: boolean;
    error: 'nickname' | 'avatar' | null;
    hydrate: () => void;
    changeNickname: (nickname: string) => void;
    selectPart: (category: AvatarCategory, id: string | null) => void;
    transformPart: (category: EditableAvatarCategory, transform: AvatarTransform) => void;
    resetPart: (category: EditableAvatarCategory) => void;
    randomize: () => void;
    save: (profile?: PlayerProfile) => boolean;
    clear: () => void;
  }>((set, get) => ({
    profile: null,
    storageIssue: null,
    draft: { nickname: '', avatar: defaultAvatar() },
    hydrated: false,
    recovered: false,
    error: null,
    hydrate() {
      if (get().hydrated) return;
      const saved = readStored(storage, PROFILE_STORAGE_KEY, storedProfileSchema);
      const profile = saved.value?.profile ?? null;
      const recovered = saved.value?.recovered ?? false;
      const issue =
        profile && recovered ? writeStored(storage, PROFILE_STORAGE_KEY, profile) : null;
      set({
        profile,
        recovered,
        hydrated: true,
        storageIssue: issue ?? saved.issue,
        draft: profile ?? { nickname: '', avatar: randomAvatar(rng) },
      });
    },
    changeNickname(nickname) {
      set({ draft: { ...get().draft, nickname }, error: null });
    },
    selectPart(category, id) {
      if (category === 'head' || get().draft.avatar[category] === id) return;
      if (
        id === null
          ? !OPTIONAL_AVATAR_CATEGORIES.some((optional) => optional === category)
          : !isValidOptionId(category, id)
      )
        return;
      const avatar = { ...get().draft.avatar, [category]: id };
      if (avatar.layout) {
        const parts = { ...avatar.layout.parts };
        delete parts[category];
        avatar.layout = { version: 1, parts };
      }
      set({
        draft: { ...get().draft, avatar },
        error: null,
      });
    },
    transformPart(category, transform) {
      if (!EDITABLE_AVATAR_CATEGORIES.includes(category) || !get().draft.avatar[category]) return;
      const parsed = avatarTransformSchema.safeParse(transform);
      if (!parsed.success) return;
      const { draft } = get();
      set({
        draft: {
          ...draft,
          avatar: {
            ...draft.avatar,
            layout: {
              version: 1,
              parts: { ...draft.avatar.layout?.parts, [category]: parsed.data },
            },
          },
        },
        error: null,
      });
    },
    resetPart(category) {
      if (!EDITABLE_AVATAR_CATEGORIES.includes(category)) return;
      const { draft } = get();
      if (!draft.avatar.layout) return;
      const parts = { ...draft.avatar.layout.parts };
      delete parts[category];
      set({
        draft: { ...draft, avatar: { ...draft.avatar, layout: { version: 1, parts } } },
        error: null,
      });
    },
    randomize() {
      const { draft } = get();
      set({
        draft: { ...draft, avatar: { ...randomAvatar(rng), head: draft.avatar.head } },
        error: null,
      });
    },
    save(profile = get().draft) {
      const parsed = playerProfileSchema.safeParse(profile);
      if (!parsed.success) {
        set({ error: nicknameSchema.safeParse(profile.nickname).success ? 'avatar' : 'nickname' });
        return false;
      }
      set({
        profile: parsed.data,
        draft: parsed.data,
        recovered: false,
        error: null,
        storageIssue: writeStored(storage, PROFILE_STORAGE_KEY, parsed.data),
      });
      return true;
    },
    clear() {
      set({
        profile: null,
        draft: { nickname: '', avatar: randomAvatar(rng) },
        recovered: false,
        error: null,
        storageIssue: writeStored(storage, PROFILE_STORAGE_KEY, null),
      });
    },
  }));
}
