import { describe, expect, it } from 'vitest';
import { roomRemovedSchema, serverEventSchema } from '../index.js';
const payload = {
  roomId: '20000000-0000-4000-8000-000000000001',
  stateVersion: 2,
  reason: 'kicked',
};
describe('remoção pública de sala', () => {
  it.each(['left', 'kicked', 'closed'])(
    'contrata o envelope de %s sem identidade de transporte',
    (reason) => {
      expect(
        serverEventSchema.safeParse({
          protocolVersion: 1,
          event: 'room:removed',
          payload: { ...payload, reason },
        }).success,
      ).toBe(true);
    },
  );
  it.each([
    { ...payload, roomId: 'invalid' },
    { ...payload, stateVersion: -1 },
    { ...payload, reason: 'private-reason' },
    { ...payload, token: 'secret' },
    { ...payload, socketId: 'private' },
  ])('rejeita dados inválidos ou privados: %j', (value) => {
    expect(roomRemovedSchema.safeParse(value).success).toBe(false);
  });
});
