import { roomCodeSchema } from '@penshow/shared';

// Ignore spacing from a pasted code, but never guess ambiguous characters or strip punctuation.
export function normalizeRoomCode(raw: string): string | null {
  const result = roomCodeSchema.safeParse(raw.replace(/\s/gu, '').toUpperCase());
  return result.success ? result.data : null;
}
