// Adapted from Comicle, MIT. See THIRD_PARTY_NOTICES.md.
import { ROOM_LIMITS } from '@penshow/shared';
import type { RandomSource } from '../../ports.js';

export const MAX_ROOM_CODE_ATTEMPTS = 20;
export function generateUniqueRoomCode(random: RandomSource, isTaken: (code: string) => boolean) {
  for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt++) {
    let code = '';
    for (let index = 0; index < ROOM_LIMITS.codeLength; index++) {
      const value = random.integer(ROOM_LIMITS.codeAlphabet.length);
      if (!Number.isInteger(value) || value < 0 || value >= ROOM_LIMITS.codeAlphabet.length)
        throw new RangeError('Índice de código inválido.');
      code += ROOM_LIMITS.codeAlphabet[value];
    }
    if (!isTaken(code)) return code;
  }
  throw new Error('Não foi possível reservar um código de sala.');
}
