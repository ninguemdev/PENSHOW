import { describe, expect, it, vi } from 'vitest';
import type { Acknowledgement, ClientCommand } from '@penshow/shared';
import { issuedSession, profile, roomView, testStores } from '../test/fixtures';
import { strings } from '../strings/pt-BR';

async function setup() {
  const f = testStores();
  f.stores.profile.getState().save(profile);
  await f.stores.session.getState().activate();
  f.callbacks()!.event({ protocolVersion: 1, event: 'room:view', payload: roomView });
  const requests: { command: ClientCommand; resolve: (ack: Acknowledgement) => void }[] = [];
  vi.mocked(f.realtime.command).mockImplementation((command) => {
    if (command.event !== 'room:sync') return Promise.reject(new Error('No clock sample'));
    return new Promise((resolve) => requests.push({ command, resolve }));
  });
  const reconnect = () => {
    f.callbacks()!.status('offline');
    f.callbacks()!.status('online');
  };
  const respond = async (index: number, present = false) => {
    const request = requests[index]!;
    request.resolve({
      protocolVersion: 1,
      actionId: request.command.actionId,
      status: 'ok',
      event: 'room:sync',
      result: present
        ? { status: 'present', roomId: roomView.roomId, stateVersion: 2 }
        : { status: 'absent' },
    });
    await Promise.resolve();
  };
  return { ...f, requests, reconnect, respond };
}
describe('reconciliação de sala por conexão', () => {
  it('sala ausente elimina fotografia velha e conserva identidade e perfil', async () => {
    const f = await setup();
    f.reconnect();
    expect(f.stores.session.getState().viewReady).toBe(false);
    await f.respond(0);
    expect(f.requests[0]!.command).toMatchObject({ event: 'room:sync', payload: {} });
    expect(f.stores.room.getState().view).toBeNull();
    expect(f.stores.session.getState().session?.playerId).toBe(issuedSession.playerId);
    expect(f.stores.profile.getState().profile).toEqual(profile);
    expect(f.stores.session.getState().message).toBe(strings.session.roomUnavailable);
  });
  it('ausência atrasada de outra conexão não remove fotografia nova', async () => {
    const f = await setup();
    f.reconnect();
    f.reconnect();
    const current = { ...roomView, stateVersion: 2 };
    f.callbacks()!.event({ protocolVersion: 1, event: 'room:view', payload: current });
    await f.respond(0);
    expect(f.stores.room.getState().view).toEqual(current);
    await f.respond(1, true);
    expect(f.stores.session.getState().viewReady).toBe(true);
    expect(f.stores.room.getState().view).toEqual(current);
  });
  it('consulta de ausência não apaga uma sala criada depois da consulta', async () => {
    const f = await setup();
    f.reconnect();
    const current = { ...roomView, stateVersion: 3 };
    f.callbacks()!.event({ protocolVersion: 1, event: 'room:view', payload: current });
    await f.respond(0);
    expect(f.stores.room.getState().view).toEqual(current);
  });
  it('falha da consulta mantém ações bloqueadas até fotografia autoritativa', async () => {
    const f = await setup();
    vi.mocked(f.realtime.command).mockRejectedValue(new Error('timeout'));
    f.reconnect();
    await Promise.resolve();
    expect(f.stores.session.getState().viewReady).toBe(false);
    expect(f.stores.room.getState().view).toEqual(roomView);
  });
});
