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
      if (
        id === null
          ? !OPTIONAL_AVATAR_CATEGORIES.some((optional) => optional === category)
          : !isValidOptionId(category, id)
      )
        return;
      set({
        draft: { ...get().draft, avatar: { ...get().draft.avatar, [category]: id } },
        error: null,
      });
    },
    randomize() {
      set({ draft: { ...get().draft, avatar: randomAvatar(rng) }, error: null });
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
