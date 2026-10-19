// Adapted from Comicle, MIT. See THIRD_PARTY_NOTICES.md.
import { AVATAR_CATEGORIES, findAvatarOption, type Avatar } from '@penshow/shared';

export function avatarArtUrl(file: string, base = import.meta.env.BASE_URL) {
  return `${base}avatars/${file}`;
}

export function avatarLayers(avatar: Avatar) {
  return AVATAR_CATEGORIES.flatMap((category) => {
    const id = avatar[category];
    const option = id === null ? undefined : findAvatarOption(category, id);
    return option ? [{ category, src: avatarArtUrl(option.file) }] : [];
  });
}
