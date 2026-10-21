import { expect, it } from 'vitest';
import { clientCommandSchema, acknowledgementSchema } from './index.js';
const actionId = '00000000-0000-4000-8000-000000000001';
const command = { protocolVersion: 1, actionId, event: 'room:sync', payload: {} };
it('reconcilia somente a associação da identidade autenticada, sem aceitar ator ou sala do cliente', () => {
  expect(clientCommandSchema.safeParse(command).success).toBe(true);
  expect(
    clientCommandSchema.safeParse({ ...command, payload: { playerId: actionId } }).success,
  ).toBe(false);
  expect(clientCommandSchema.safeParse({ ...command, payload: { roomId: actionId } }).success).toBe(
    false,
  );
  expect(
    acknowledgementSchema.safeParse({
      protocolVersion: 1,
      actionId,
      status: 'ok',
      event: 'room:sync',
      result: { status: 'absent' },
    }).success,
  ).toBe(true);
  expect(
    acknowledgementSchema.safeParse({
      protocolVersion: 1,
      actionId,
      status: 'ok',
      event: 'room:sync',
      result: { status: 'present', roomId: actionId },
    }).success,
  ).toBe(false);
});
