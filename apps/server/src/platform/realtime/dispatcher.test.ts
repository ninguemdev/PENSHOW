import { playerIdSchema } from '@penshow/shared';
import { describe, expect, it, vi } from 'vitest';
import { PublicCommandError } from '../../command-error.js';
import { createTestRuntime } from '../../test-support/runtime.js';
import { createDispatcher } from './dispatcher.js';
import type { CommandHandlers } from './dispatcher.js';

const actor = playerIdSchema.parse('00000000-0000-4000-8000-000000000001');
const actionId = '00000000-0000-4000-8000-000000000002';
const roomId = '00000000-0000-4000-8000-000000000003';
const leave = { protocolVersion: 1, actionId, event: 'room:leave', payload: { roomId } };

function setup(handlers: CommandHandlers = {}) {
  const { runtime } = createTestRuntime();
  const report = vi.fn();
  const identify = vi.fn(() => actor);
  return {
    dispatch: createDispatcher({
      clock: runtime.clock,
      maxBytes: 1024,
      handlers,
      onInternalError: report,
    }),
    identify,
    report,
  };
}

describe('despacho de comandos', () => {
  it('consulta tempo pelo relógio injetado sem autenticação nem efeito de jogo', async () => {
    const { dispatch, identify } = setup();
    const result = await dispatch(
      'time:sync',
      { protocolVersion: 1, actionId, event: 'time:sync', payload: { clientSentAt: 500 } },
      identify,
    );
    expect(result).toEqual({
      protocolVersion: 1,
      actionId,
      status: 'ok',
      event: 'time:sync',
      result: { clientSentAt: 500, serverReceivedAt: 1000, serverSentAt: 1000 },
    });
    expect(identify).not.toHaveBeenCalled();
  });
  it('valida o envelope antes de identificar ator e delegar', async () => {
    const service = vi.fn(() => ({}));
    const { dispatch, identify } = setup({ 'room:leave': service });
    expect((await dispatch('room:leave', leave, identify)).status).toBe('ok');
    expect(service).toHaveBeenCalledWith(actor, leave);
    expect(identify).toHaveBeenCalledOnce();
    expect(
      await dispatch('room:leave', { ...leave, payload: { roomId, playerId: actor } }, identify),
    ).toMatchObject({ status: 'error', error: { code: 'INVALID_PAYLOAD' } });
    expect(service).toHaveBeenCalledOnce();
    expect(identify).toHaveBeenCalledOnce();
  });
  it('recusa evento desconhecido e nome externo divergente', async () => {
    const { dispatch, identify } = setup();
    expect(await dispatch('room:secret', leave, identify)).toMatchObject({
      actionId,
      error: { code: 'UNKNOWN_EVENT' },
    });
    expect(await dispatch('room:kick', leave, identify)).toMatchObject({
      error: { code: 'INVALID_PAYLOAD' },
    });
    expect(await dispatch('room:leave', undefined, identify)).toMatchObject({
      actionId: null,
      error: { code: 'INVALID_PAYLOAD' },
    });
    expect(await dispatch('room:leave', { ...leave, protocolVersion: 2 }, identify)).toMatchObject({
      error: { code: 'INVALID_PAYLOAD' },
    });
    expect(identify).not.toHaveBeenCalled();
  });
  it('recusa payload grande ou não serializável antes do serviço', async () => {
    const service = vi.fn(() => ({}));
    const { dispatch, identify } = setup({ 'room:leave': service });
    expect(
      await dispatch('room:leave', { ...leave, secret: 'x'.repeat(2048) }, identify),
    ).toMatchObject({ error: { code: 'INVALID_PAYLOAD' } });
    expect(await dispatch('room:leave', { ...leave, value: BigInt(1) }, identify)).toMatchObject({
      error: { code: 'INVALID_PAYLOAD' },
    });
    expect(service).not.toHaveBeenCalled();
  });
  it('exige ator e não finge executar comandos sem serviço', async () => {
    const { dispatch } = setup();
    expect(await dispatch('room:leave', leave, () => null)).toMatchObject({
      error: { code: 'UNAUTHENTICATED' },
    });
    expect(await dispatch('room:leave', leave, () => actor)).toMatchObject({
      error: { code: 'INVALID_PHASE' },
    });
  });
  it('preserva erros públicos e sanitiza exceções do serviço e identificador', async () => {
    const publicFailure = setup({
      'room:leave': () => {
        throw new PublicCommandError('ROOM_NOT_FOUND');
      },
    });
    expect(await publicFailure.dispatch('room:leave', leave, publicFailure.identify)).toMatchObject(
      { error: { code: 'ROOM_NOT_FOUND' } },
    );
    expect(publicFailure.report).not.toHaveBeenCalled();
    const failure = setup({
      'room:leave': () => {
        throw new Error('token-secreto resposta-secreta');
      },
    });
    const result = await failure.dispatch('room:leave', leave, failure.identify);
    expect(result).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(failure.report).toHaveBeenCalledWith();
    expect(
      await failure.dispatch('room:leave', leave, () => {
        throw new Error('token-secreto');
      }),
    ).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
  });
  it('valida também a saída do serviço', async () => {
    const { dispatch, identify, report } = setup({ 'room:leave': () => ({ stateVersion: 1 }) });
    expect(await dispatch('room:leave', leave, identify)).toMatchObject({
      error: { code: 'INTERNAL_ERROR' },
    });
    expect(report).toHaveBeenCalledOnce();
  });
});
