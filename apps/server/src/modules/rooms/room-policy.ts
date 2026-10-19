export interface RoomPolicy {
  hostTransferGraceMs: number;
  lobbyRemovalMs: number;
  emptyRoomTtlMs: number;
  maxAgeMs: number;
}
// Prototype lifecycle values, separate from the experimental quiz timings (D01).
export const DEFAULT_ROOM_POLICY: Readonly<RoomPolicy> = Object.freeze({
  hostTransferGraceMs: 30_000,
  lobbyRemovalMs: 120_000,
  emptyRoomTtlMs: 120_000,
  maxAgeMs: 12 * 60 * 60 * 1000,
});
export function validateRoomPolicy(policy: RoomPolicy): Readonly<RoomPolicy> {
  if (
    [
      policy.hostTransferGraceMs,
      policy.lobbyRemovalMs,
      policy.emptyRoomTtlMs,
      policy.maxAgeMs,
    ].some((value) => !Number.isSafeInteger(value) || value < 1)
  )
    throw new Error('Os prazos da sala devem ser inteiros positivos.');
  return Object.freeze({ ...policy });
}
