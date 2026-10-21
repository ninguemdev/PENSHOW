import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actionIdSchema, createDomainError } from '@penshow/shared';
import { createRealtimeClient } from './socket';
import { issuedSession } from '../test/fixtures';

const socket = vi.hoisted(() => {
  const listeners = new Map<string, (value?: unknown) => void>();
  const fake = {
    connected: false,
    auth: {},
    listeners,
    on: vi.fn((name, callback) => {
      listeners.set(name, callback);
      return fake;
    }),
    connect: vi.fn(),
    disconnect: vi.fn(() => fake),
    removeAllListeners: vi.fn(() => {
      listeners.clear();
      return fake;
    }),
    timeout: vi.fn(() => fake),
    emitWithAck: vi.fn(),
  };
  return fake;
});
vi.mock('socket.io-client', () => ({ io: () => socket }));
const command = {
  protocolVersion: 1 as const,
  actionId: actionIdSchema.parse('30000000-0000-4000-8000-000000000001'),
  event: 'time:sync' as const,
  payload: { clientSentAt: 1000 },
};
const ack = {
  protocolVersion: 1,
  actionId: command.actionId,
  status: 'ok',
  event: 'time:sync',
  result: { clientSentAt: 1000, serverReceivedAt: 1001, serverSentAt: 1002 },
};

beforeEach(() => {
  socket.connected = false;
  socket.listeners.clear();
  vi.clearAllMocks();
});
describe('transporte PENSHOW', () => {
  it('credencial recusada no retorno encerra sessão; falha transitória não apaga identidade', () => {
    const callbacks = { status: vi.fn(), event: vi.fn(), invalid: vi.fn() };
    createRealtimeClient().connect(issuedSession.token, callbacks);
    socket.listeners.get('connect_error')?.(new Error('network'));
    expect(callbacks.event).not.toHaveBeenCalled();
    socket.listeners.get('connect_error')?.(
      Object.assign(new Error('rejected'), { data: createDomainError('UNAUTHENTICATED') }),
    );
    expect(callbacks.event).toHaveBeenCalledWith({
      protocolVersion: 1,
      event: 'session:ended',
      payload: { reason: 'expired' },
    });
  });
  it('não enfileira comandos offline e oculta a credencial ao encerrar', async () => {
    const client = createRealtimeClient();
    const callbacks = { status: vi.fn(), event: vi.fn(), invalid: vi.fn() };
    client.connect(issuedSession.token, callbacks);
    expect(socket.auth).toEqual({ token: issuedSession.token });
    await expect(client.command(command)).rejects.toThrow('Conecte-se');
    expect(socket.emitWithAck).not.toHaveBeenCalled();
    client.disconnect();
    expect(socket.auth).toEqual({});
  });
  it('valida o envelope de eventos e o nome do canal antes de encaminhar', () => {
    const callbacks = { status: vi.fn(), event: vi.fn(), invalid: vi.fn() };
    createRealtimeClient().connect(issuedSession.token, callbacks);
    const ended = { protocolVersion: 1, event: 'session:ended', payload: { reason: 'replaced' } };
    socket.listeners.get('room:view')?.(ended);
    socket.listeners.get('session:ended')?.({ ...ended, protocolVersion: 2 });
    expect(callbacks.invalid).toHaveBeenCalledTimes(2);
    expect(callbacks.event).not.toHaveBeenCalled();
    socket.listeners.get('session:ended')?.(ended);
    expect(callbacks.event).toHaveBeenCalledWith(ended);
  });
  it('envia o envelope e aceita somente a confirmação da mesma ação', async () => {
    const client = createRealtimeClient();
    socket.connected = true;
    socket.emitWithAck.mockResolvedValue(ack);
    await expect(client.command(command)).resolves.toEqual(ack);
    expect(socket.emitWithAck).toHaveBeenCalledWith('time:sync', command);
    socket.emitWithAck.mockResolvedValue({
      ...ack,
      actionId: '30000000-0000-4000-8000-000000000002',
    });
    await expect(client.command(command)).rejects.toThrow('inesperada');
  });
  it('não transforma timeout ou confirmação malformada em sucesso', async () => {
    const client = createRealtimeClient();
    socket.connected = true;
    socket.emitWithAck.mockRejectedValueOnce(new Error('timeout'));
    await expect(client.command(command)).rejects.toThrow('confirmação');
    socket.emitWithAck.mockResolvedValue({ status: 'ok' });
    await expect(client.command(command)).rejects.toThrow('inesperada');
  });
});
