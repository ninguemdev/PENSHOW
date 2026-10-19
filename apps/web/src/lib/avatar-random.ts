import type { AvatarRandom } from '@penshow/shared';

// Appearance has no competitive effect; gameplay randomness remains on the server.
export const avatarRandom: AvatarRandom = {
  integer: (maxExclusive) => Math.floor(Math.random() * maxExclusive),
};
