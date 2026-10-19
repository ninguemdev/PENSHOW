import { describe, expect, it, vi } from 'vitest';
import {
  defaultAvatar,
  matchIdSchema,
  playerIdSchema,
  roomIdSchema,
  serverEventSchema,
} from '@penshow/shared';
import type { RoomState } from '../rooms/room.js';
import { buildPlayerView } from './build-player-view.js';
import { createRoomPublisher } from './room-publisher.js';

const player = (n: number) =>
  playerIdSchema.parse(`10000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
function state(): RoomState {
  return {
    roomId: roomIdSchema.parse('20000000-0000-4000-8000-000000000001'),
    code: 'ABCDEF',
    createdAt: 100,
    lobbySince: 100,
    stateVersion: 3,
    phaseEpoch: 0,
    settings: { format: 'prototype-v1', maxPlayers: 3, enabledCategories: ['history'] },
    members: [1, 2].map((n) => ({
      playerId: player(n),
      role: 'player',
      joinedAt: n,
      profile: { nickname: `Pessoa ${n}`, avatar: defaultAvatar() },
      connection: { status: 'connected', connectionId: `private-${n}` },
    })),
    hostPlayerId: player(1),
    hostTransferPending: false,
    bannedPlayerIds: [player(3)],
    emptySince: null,
    phase: { status: 'lobby' },
  };
}
describe('projeção pública por destinatário', () => {
  it('expõe só campos públicos por lista explícita, incluindo objetos aninhados', () => {
    const room = state();
    Object.assign(room, {
      guestId: 'secret-guest',
      token: 'secret-token',
      futureQuestions: ['secret-answer'],
    });
    Object.assign(room.members[1]!, { socketId: 'secret-socket', tokenHash: 'secret-hash' });
    Object.assign(room.members[1]!.profile, { token: 'secret-nested-profile' });
    Object.assign(room.members[1]!.profile.avatar, { correctOptionId: 'secret-nested-avatar' });
    const view = buildPlayerView(room, player(1), 200)!;
    expect(view.viewerId).toBe(player(1));
    expect(view.members.map((m) => m.isHost)).toEqual([true, false]);
    const serialized = JSON.stringify(view);
    for (const forbidden of [
      'guestId',
      'token',
      'socketId',
      'connectionId',
      'bannedPlayerIds',
      'futureQuestions',
      'correctOptionId',
      'secret-',
      'phaseEpoch',
      'createdAt',
      'emptySince',
    ])
      expect(serialized).not.toContain(forbidden);
    expect(view.serverNow).toBe(200);
    expect(view.stateVersion).toBe(3);
    view.members[0]!.profile.nickname = 'Changed';
    expect(room.members[0]!.profile.nickname).toBe('Pessoa 1');
  });
  it('representa presença e papel sem transformar espectador em anfitrião', () => {
    const room = state();
    room.members[1]!.role = 'spectator';
    room.members[1]!.connection = { status: 'disconnected', since: 150 };
    const view = buildPlayerView(room, player(2), 200)!;
    expect(view.members[1]).toMatchObject({
      role: 'spectator',
      isHost: false,
      connection: { status: 'disconnected', since: 150 },
    });
    expect(buildPlayerView(room, player(3), 200)).toBe(null);
  });
  it('projeta encerramento e não usa lobby como substituto para partida sem projetor', () => {
    const room = state();
    room.phase = { status: 'closed', reason: 'expired' };
    expect(buildPlayerView(room, player(1), 200)?.state).toEqual({
      status: 'closed',
      reason: 'expired',
    });
    room.phase = {
      status: 'match',
      roster: {
        matchId: matchIdSchema.parse('30000000-0000-4000-8000-000000000001'),
        startedAt: 200,
        settings: room.settings,
        players: room.members.map((m) => ({ playerId: m.playerId, profile: m.profile })),
      },
    };
    expect(buildPlayerView(room, player(1), 200)).toBe(null);
  });
});
describe('publicador de sala', () => {
  it('publica somente remoção no fechamento, sem enfileirar uma fotografia terminal redundante', () => {
    const before = state(),
      after = state();
    after.phase = { status: 'closed', reason: 'server-shutdown' };
    const send = vi.fn();
    createRoomPublisher({
      clock: { now: () => 200 },
      isCurrent: () => true,
      send,
      onError: vi.fn(),
    })(after, before);
    expect(send.mock.calls.map(([, event]) => event.event)).toEqual([
      'room:removed',
      'room:removed',
    ]);
    expect(send.mock.calls.every(([, event]) => event.payload.reason === 'closed')).toBe(true);
  });
  it('usa um instante/versão por mutação e entrega só à conexão atual de cada destinatário', () => {
    const after = state(),
      before = state();
    before.stateVersion--;
    const send = vi.fn();
    const now = vi.fn(() => 200);
    createRoomPublisher({
      clock: { now },
      isCurrent: (actor) => actor.playerId === player(1),
      send,
      onError: vi.fn(),
    })(after, before);
    expect(now).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0]).toEqual({ playerId: player(1), connectionId: 'private-1' });
    expect(serverEventSchema.parse(send.mock.calls[0]![1])).toMatchObject({
      event: 'room:view',
      payload: { viewerId: player(1), stateVersion: 3, serverNow: 200 },
    });
  });
  it('envia remoção ao expulso sem entregar a ele a nova fotografia dos demais', () => {
    const before = state(),
      after = state();
    after.members.pop();
    after.bannedPlayerIds.push(player(2));
    const send = vi.fn();
    createRoomPublisher({
      clock: { now: () => 200 },
      isCurrent: () => true,
      send,
      onError: vi.fn(),
    })(after, before);
    expect(send.mock.calls.map(([actor, event]) => [actor.playerId, event.event])).toEqual([
      [player(1), 'room:view'],
      [player(2), 'room:removed'],
    ]);
    expect(send.mock.calls[1]![1].payload).toEqual({
      roomId: after.roomId,
      stateVersion: 3,
      reason: 'kicked',
    });
  });
  it('continua entregando aos outros destinatários se uma emissão falhar', () => {
    const send = vi.fn().mockImplementationOnce(() => {
      throw new Error('private delivery failure');
    });
    const report = vi.fn();
    createRoomPublisher({
      clock: { now: () => 200 },
      isCurrent: () => true,
      send,
      onError: report,
    })(state(), state());
    expect(send).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledWith();
  });
});
