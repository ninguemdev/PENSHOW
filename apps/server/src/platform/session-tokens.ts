import { createHash, randomBytes } from 'node:crypto';
import type { SessionTokenCodec } from '../ports.js';

export function createSystemSessionTokens(): SessionTokenCodec {
  return {
    issue: () => `penshow_v1_${randomBytes(32).toString('base64url')}`,
    hash: (token) =>
      createHash('sha256').update('penshow:guest-session:v1:').update(token).digest('hex'),
  };
}
