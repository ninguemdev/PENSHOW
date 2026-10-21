import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultAvatar,
  matchIdSchema,
  playerIdSchema,
  roomCodeSchema,
  ROOM_LIMITS,
  type PlayerProfile,
  type RoomSettings,
} from '@penshow/shared';
import { PublicCommandError } from '../../command-error.js';
import { createTestRuntime } from '../../test-support/runtime.js';
import { RoomService, type RoomActor } from './room.service.js';
import { generateUniqueRoomCode, MAX_ROOM_CODE_ATTEMPTS } from './room-code.js';
import { DEFAULT_ROOM_POLICY } from './room-policy.js';

const services: RoomService[] = [];
afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.dispose()));
});
const actor = (index: number, connectionId = `connection-${index}`): RoomActor => ({
  playerId: playerIdSchema.parse(`10000000-0000-4000-8000-${String(index).padStart(12, '0')}`),
  connectionId,
});
const profile: PlayerProfile = { nickname: 'Ana', avatar: defaultAvatar() };
const settings: RoomSettings = {
  format: 'prototype-v1',
  maxPlayers: 3,
  enabledCategories: ['history'],
};
function setup(overrides: Partial<ConstructorParameters<typeof RoomService>[0]> = {}) {
  const { time, runtime } = createTestRuntime();
  let draws = 0;
  runtime.random = { integer: (max) => Math.floor(draws++ / ROOM_LIMITS.codeLength) % max };
  const changes = vi.fn();
  const quiz = { validateStart: vi.fn() };
  const service = new RoomService({
    runtime,
    policy: { hostTransferGraceMs: 10, lobbyRemovalMs: 30, emptyRoomTtlMs: 60, maxAgeMs: 1000 },
    quiz,
    onChange: changes,
    ...overrides,
  });
  services.push(service);
  return { service, time, runtime, changes, quiz };
}
async function failure(action: () => unknown, code: string) {
  await expect(Promise.resolve().then(action)).rejects.toMatchObject({ code });
}

describe('criação, capacidade e autorização', () => {
  it('limita salas simultâneas sem reservar identidade e libera a vaga ao encerrar', async () => {
    const { service } = setup({ maxRooms: 1 });
    const first = await service.create(actor(1), profile, settings);
    await failure(() => service.create(actor(2), profile, settings), 'SERVER_BUSY');
    expect(service.registry.roomOf(actor(2).playerId)).toBeUndefined();
    expect(service.registry.all()).toHaveLength(1);
    await service.close(first.roomId);
    expect(await service.create(actor(2), profile, settings)).toMatchObject({
      playerId: actor(2).playerId,
    });
  });
  it('registra por código/ID, reserva a identidade e preserva snapshots isolados', async () => {
    const { service, changes } = setup();
    const entry = await service.create(actor(1), profile, settings);
    const room = service.registry.byId(entry.roomId)!;
    expect(roomCodeSchema.safeParse(entry.code).success).toBe(true);
    expect(service.registry.byCode(entry.code)).toBe(room);
    expect(service.registry.roomOf(actor(1).playerId)).toBe(entry.roomId);
    expect(entry.stateVersion).toBe(1);
    const copy = room.snapshot();
    copy.members[0]!.profile.nickname = 'Injected';
    changes.mock.calls[0]![0].settings.enabledCategories.push('injected');
    expect(room.snapshot().members[0]!.profile.nickname).toBe('Ana');
    expect(room.snapshot().settings.enabledCategories).toEqual(['history']);
  });
  it('gera novamente em colisão e falha de modo limitado se todos os códigos estiverem ocupados', async () => {
    const { service, runtime } = setup();
    runtime.random = { integer: vi.fn().mockReturnValue(0) };
    const first = await service.create(actor(1), profile, settings);
    let draws = 0;
    runtime.random.integer = vi.fn(() => (draws++ < 6 ? 0 : 1));
    const second = await service.create(actor(2), profile, settings);
    expect(first.code).toBe('AAAAAA');
    expect(second.code).toBe('BBBBBB');
    runtime.random.integer = vi.fn(() => 0);
    await expect(
      Promise.resolve().then(() => service.create(actor(3), profile, settings)),
    ).rejects.toThrow('código');
    expect(runtime.random.integer).toHaveBeenCalledTimes(
      MAX_ROOM_CODE_ATTEMPTS * ROOM_LIMITS.codeLength,
    );
    expect(service.registry.roomOf(actor(3).playerId)).toBeUndefined();
    expect(service.registry.all()).toHaveLength(2);
  });
  it.each([-1, 32, 0.5, NaN])('rejeita sorteio inválido %s', (value) => {
    expect(() => generateUniqueRoomCode({ integer: () => value }, () => false)).toThrow(RangeError);
  });
  it('rejeita colisão de ID sem sobrescrever outra sala', async () => {
    const { service, runtime } = setup();
    const first = await service.create(actor(1), profile, settings);
    runtime.ids.next = () => first.roomId;
    await expect(
      Promise.resolve().then(() => service.create(actor(2), profile, settings)),
    ).rejects.toThrow('uso');
    expect(service.registry.byId(first.roomId)?.snapshot().members[0]!.playerId).toBe(
      actor(1).playerId,
    );
    expect(service.registry.roomOf(actor(2).playerId)).toBeUndefined();
  });
  it('aceita 12 jogadores e reconecta membro existente antes de conferir capacidade', async () => {
    const { service } = setup();
    const entry = await service.create(actor(1), profile, { ...settings, maxPlayers: 12 });
    for (let index = 2; index <= 12; index++) await service.join(actor(index), entry.code, profile);
    await failure(() => service.join(actor(13), entry.code, profile), 'ROOM_FULL');
    expect(service.registry.roomOf(actor(13).playerId)).toBeUndefined();
    await service.disconnect(actor(12));
    const replacement = actor(12, 'replacement');
    await service.join(replacement, entry.code, { ...profile, nickname: 'Bia' });
    const room = service.registry.byId(entry.roomId)!;
    expect(room.snapshot().members).toHaveLength(12);
    expect(room.snapshot().members[11]!.profile.nickname).toBe('Bia');
    const version = room.snapshot().stateVersion;
    await service.disconnect(actor(12));
    expect(room.snapshot().stateVersion).toBe(version);
    await failure(() => service.updateProfile(actor(12), entry.roomId, profile), 'UNAUTHENTICATED');
  });
  it('serializa a disputa pela última vaga e libera a reserva de quem perdeu', async () => {
    const { service } = setup();
    const entry = await service.create(actor(1), profile, { ...settings, maxPlayers: 2 });
    const results = await Promise.allSettled([
      service.join(actor(2), entry.code, profile),
      service.join(actor(3), entry.code, profile),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(service.registry.byId(entry.roomId)!.snapshot().members).toHaveLength(2);
    expect(service.registry.roomOf(actor(3).playerId)).toBeUndefined();
  });
  it('impede criar/entrar em duas salas, inclusive em admissões concorrentes', async () => {
    const { service } = setup();
    const first = await service.create(actor(1), profile, settings);
    const second = await service.create(actor(2), profile, settings);
    const result = await Promise.allSettled([
      service.join(actor(3), first.code, profile),
      service.join(actor(3), second.code, profile),
    ]);
    expect(result.map((item) => item.status)).toEqual(['fulfilled', 'rejected']);
    await failure(() => service.create(actor(3), profile, settings), 'INVALID_PHASE');
    await failure(() => service.updateProfile(actor(2), first.roomId, profile), 'NOT_A_MEMBER');
    await failure(() => service.updateSettings(actor(3), first.roomId, settings), 'FORBIDDEN');
  });
  it('valida perfil, settings e código no serviço e nunca reduz capacidade abaixo da ocupação', async () => {
    const { service } = setup();
    await failure(
      () => service.create(actor(1), { ...profile, nickname: '' }, settings),
      'INVALID_PAYLOAD',
    );
    await failure(
      () => service.create(actor(1), profile, { ...settings, maxPlayers: 13 }),
      'INVALID_SETTINGS',
    );
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    await service.join(actor(3), entry.code, profile);
    await failure(
      () => service.updateSettings(actor(1), entry.roomId, { ...settings, maxPlayers: 2 }),
      'INVALID_SETTINGS',
    );
    await failure(() => service.join(actor(4), '../wrong', profile), 'INVALID_PAYLOAD');
    await failure(() => service.join(actor(4), 'ZZZZZZ', profile), 'ROOM_NOT_FOUND');
    await service.updateProfile(actor(2), entry.roomId, {
      ...profile,
      nickname: ' Ame\u0301lia  Silva ',
    });
    expect(service.registry.byId(entry.roomId)!.snapshot().members[1]!.profile.nickname).toBe(
      'Amélia Silva',
    );
  });
});

describe('fila, presença e anfitrião', () => {
  it('não ressuscita uma criação ainda provisória quando a conexão é substituída', async () => {
    let current = 'connection-1';
    const { service, time } = setup({
      isCurrentActor: (candidate) => candidate.connectionId === current,
    });
    const pending = service.create(actor(1), profile, settings);
    current = 'replacement';
    await service.reconnect(actor(1, current));
    await expect(pending).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(service.registry.all()).toHaveLength(0);
    expect(time.pendingCount).toBe(0);
  });
  it('não publica rascunho sem commit, rejeita invariantes quebradas e não vaza referências mutáveis', async () => {
    const { service } = setup();
    const entry = await service.create(actor(1), profile, settings);
    const room = service.registry.byId(entry.roomId)!;
    let leaked: Parameters<Parameters<typeof room.runExclusive>[0]>[0] | undefined;
    await room.runExclusive((tx) => {
      leaked = tx;
      tx.state.members[0]!.profile.nickname = 'Uncommitted';
    });
    expect(room.snapshot().members[0]!.profile.nickname).toBe('Ana');
    expect(() => leaked!.touch()).toThrow('terminou');
    await expect(
      room.runExclusive((tx) => {
        tx.state.hostPlayerId = actor(5).playerId;
        tx.touch();
      }),
    ).rejects.toThrow('anfitrião');
    await service.updateProfile(actor(1), entry.roomId, { ...profile, nickname: 'Valid' });
    leaked!.state.members[0]!.profile.nickname = 'Leaked';
    expect(room.snapshot().members[0]!.profile.nickname).toBe('Valid');
  });
  it('aguarda tarefa anterior, descarta rascunho rejeitado e executa a próxima mutação', async () => {
    const { service } = setup();
    const entry = await service.create(actor(1), profile, settings);
    const room = service.registry.byId(entry.roomId)!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = room.runExclusive(async (tx) => {
      tx.state.members[0]!.profile.nickname = 'Never committed';
      tx.touch();
      await gate;
      throw new Error('failure');
    });
    const rejected = expect(first).rejects.toThrow('failure');
    const next = service.updateProfile(actor(1), entry.roomId, { ...profile, nickname: 'Depois' });
    await Promise.resolve();
    expect(room.snapshot().members[0]!.profile.nickname).toBe('Ana');
    release();
    await rejected;
    await next;
    expect(room.snapshot().members[0]!.profile.nickname).toBe('Depois');
    expect(room.snapshot().stateVersion).toBe(2);
  });
  it('reconfere a autenticação depois da espera na fila', async () => {
    let valid = true;
    const { service } = setup({ isCurrentActor: () => valid });
    const entry = await service.create(actor(1), profile, settings);
    const action = service.updateProfile(actor(1), entry.roomId, { ...profile, nickname: 'Stale' });
    valid = false;
    await expect(action).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(service.registry.byId(entry.roomId)!.snapshot().members[0]!.profile.nickname).toBe(
      'Ana',
    );
  });
  it('mantém o anfitrião durante a carência, cancela no retorno e transfere para o mais antigo conectado', async () => {
    const { service, time } = setup();
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    await service.join(actor(3), entry.code, profile);
    await service.disconnect(actor(1));
    await time.advanceTo(1009);
    const room = service.registry.byId(entry.roomId)!;
    expect(room.snapshot().hostPlayerId).toBe(actor(1).playerId);
    await service.join(actor(1, 'new-host-connection'), entry.code, profile);
    await time.advanceTo(1011);
    expect(room.snapshot().hostPlayerId).toBe(actor(1).playerId);
    await service.disconnect(actor(1, 'new-host-connection'));
    await time.advanceTo(1021);
    expect(room.snapshot().hostPlayerId).toBe(actor(2).playerId);
  });
  it('preserva anfitrião pendente quando ninguém está conectado e entrega ao primeiro jogador que volta', async () => {
    const { service, time } = setup();
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    await service.disconnect(actor(1));
    await service.disconnect(actor(2));
    await time.advanceTo(1010);
    const room = service.registry.byId(entry.roomId)!;
    expect(room.snapshot().hostTransferPending).toBe(true);
    await service.join(actor(2, 'returned'), entry.code, profile);
    expect(room.snapshot().hostPlayerId).toBe(actor(2).playerId);
    expect(room.snapshot().hostTransferPending).toBe(false);
  });
  it('expulsa só no lobby, bloqueia reentrada da mesma identidade e rejeita alvo inválido', async () => {
    const { service } = setup();
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    await failure(() => service.kick(actor(2), entry.roomId, actor(1).playerId), 'FORBIDDEN');
    await failure(() => service.kick(actor(1), entry.roomId, actor(1).playerId), 'INVALID_TARGET');
    await failure(() => service.kick(actor(1), entry.roomId, actor(3).playerId), 'INVALID_TARGET');
    await service.kick(actor(1), entry.roomId, actor(2).playerId);
    expect(service.registry.roomOf(actor(2).playerId)).toBeUndefined();
    await failure(() => service.join(actor(2, 'new'), entry.code, profile), 'FORBIDDEN');
    await service.join(actor(3), entry.code, profile);
  });
  it('remove ausente no lobby sem renovar o prazo por outra mutação e transfere a liderança na saída', async () => {
    const { service, time } = setup();
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    await service.disconnect(actor(2));
    await time.advanceTo(1029);
    await service.updateProfile(actor(1), entry.roomId, { ...profile, nickname: 'Host' });
    await time.advanceTo(1030);
    expect(service.registry.roomOf(actor(2).playerId)).toBeUndefined();
    await service.join(actor(3), entry.code, profile);
    await service.leave(actor(1), entry.roomId);
    expect(service.registry.byId(entry.roomId)!.snapshot().hostPlayerId).toBe(actor(3).playerId);
  });
});

describe('limite com o ciclo de quiz', () => {
  it('não permite que o validador de quiz altere perfis ou configurações da sala', async () => {
    const { service, quiz } = setup();
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    quiz.validateStart.mockImplementation((roster: import('./room.js').QuizRoster) => {
      roster.players[0]!.profile.nickname = 'Injected';
      roster.settings.enabledCategories.push('injected');
    });
    await service.start(actor(1), entry.roomId);
    const phase = service.registry.byId(entry.roomId)!.snapshot().phase;
    if (phase.status !== 'match') throw new Error('Missing match boundary');
    expect(phase.roster.players[0]!.profile.nickname).toBe('Ana');
    expect(phase.roster.settings.enabledCategories).toEqual(['history']);
  });
  it('só inicia pelo anfitrião, exige dois conectados e mantém lobby quando o motor está ausente', async () => {
    const { runtime } = createTestRuntime(1000, Array<number>(6).fill(0));
    const service = new RoomService({ runtime });
    services.push(service);
    const entry = await service.create(actor(1), profile, settings);
    await failure(() => service.start(actor(1), entry.roomId), 'NOT_ENOUGH_PLAYERS');
    await service.join(actor(2), entry.code, profile);
    await failure(() => service.start(actor(2), entry.roomId), 'FORBIDDEN');
    await failure(() => service.start(actor(1), entry.roomId), 'INVALID_PHASE');
    expect(service.registry.byId(entry.roomId)!.snapshot().phase.status).toBe('lobby');
  });
  it('congela perfis/settings, mantém vagas da partida e admite novos membros só como espectadores', async () => {
    const { service, time, quiz } = setup();
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    const started = await service.start(actor(1), entry.roomId);
    expect(quiz.validateStart).toHaveBeenCalledTimes(1);
    const room = service.registry.byId(entry.roomId)!;
    const frozen = room.snapshot().phase;
    await service.join(actor(3), entry.code, profile);
    expect(room.snapshot().members[2]!.role).toBe('spectator');
    await failure(() => service.kick(actor(1), entry.roomId, actor(2).playerId), 'INVALID_PHASE');
    await failure(() => service.updateSettings(actor(1), entry.roomId, settings), 'INVALID_PHASE');
    await failure(
      () => service.updateProfile(actor(2), entry.roomId, { ...profile, nickname: 'Changed' }),
      'INVALID_PHASE',
    );
    await service.leave(actor(2), entry.roomId);
    await time.advanceTo(1040);
    expect(service.registry.roomOf(actor(2).playerId)).toBe(entry.roomId);
    await service.join(actor(2, 'return'), entry.code, { ...profile, nickname: 'Changed' });
    expect(room.snapshot().members[1]!.profile.nickname).toBe('Ana');
    expect(room.snapshot().phase).toEqual(frozen);
    await service.leave(actor(3), entry.roomId);
    expect(service.registry.roomOf(actor(3).playerId)).toBeUndefined();
    await service.returnToLobby(actor(1), entry.roomId, started.matchId);
    expect(room.snapshot().phase.status).toBe('lobby');
  });
  it('não altera a sala se a preparação do quiz falhar', async () => {
    const { service, quiz } = setup();
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    const room = service.registry.byId(entry.roomId)!;
    const before = room.snapshot();
    quiz.validateStart.mockImplementation(() => {
      throw new PublicCommandError('INSUFFICIENT_QUESTIONS');
    });
    await failure(() => service.start(actor(1), entry.roomId), 'INSUFFICIENT_QUESTIONS');
    expect(room.snapshot()).toEqual(before);
    await service.updateSettings(actor(1), entry.roomId, { ...settings, maxPlayers: 4 });
  });
  it('limita espectadores junto aos jogadores a 100 membros', async () => {
    const { service } = setup();
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    await service.start(actor(1), entry.roomId);
    for (let index = 3; index <= 100; index++)
      await service.join(actor(index), entry.code, profile);
    await failure(() => service.join(actor(101), entry.code, profile), 'ROOM_FULL');
    await service.join(actor(100, 'replacement'), entry.code, profile);
    expect(service.registry.byId(entry.roomId)!.snapshot().members).toHaveLength(100);
  });
  it('retorno ao lobby promove espectadores até a capacidade e dá nova carência aos ausentes', async () => {
    const { service, time } = setup();
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    const start = await service.start(actor(1), entry.roomId);
    await service.join(actor(3), entry.code, profile);
    await service.disconnect(actor(2));
    await time.advanceTo(1050);
    await service.returnToLobby(actor(1), entry.roomId, start.matchId);
    const room = service.registry.byId(entry.roomId)!;
    expect(room.snapshot().members[2]!.role).toBe('player');
    await time.advanceTo(1079);
    expect(service.registry.roomOf(actor(2).playerId)).toBe(entry.roomId);
    await time.advanceTo(1080);
    expect(service.registry.roomOf(actor(2).playerId)).toBeUndefined();
  });
});

describe('limites de reconexão da T26', () => {
  it.each([119999, 120000, 120001])(
    'sala vazia: retorno após %i ms respeita o TTL original',
    async (elapsed) => {
      const { service, time } = setup({ policy: DEFAULT_ROOM_POLICY });
      const entry = await service.create(actor(1), profile, settings);
      await service.join(actor(2), entry.code, profile);
      const room = service.registry.byId(entry.roomId)!;
      await service.disconnect(actor(1));
      await service.disconnect(actor(2));
      await time.advanceTo(1000 + elapsed);
      const result = await service.sync(actor(2, 'returned'));
      expect(result.status).toBe(elapsed < 120000 ? 'present' : 'absent');
      expect(service.registry.byId(room.id) === room).toBe(elapsed < 120000);
      if (elapsed >= 120000)
        expect(room.snapshot().phase).toEqual({ status: 'closed', reason: 'expired' });
    },
  );
  it.each([29999, 30000])(
    'anfitrião retorna após %i ms sem recuperar controle já transferido',
    async (elapsed) => {
      const { service, time } = setup({ policy: DEFAULT_ROOM_POLICY });
      const entry = await service.create(actor(1), profile, settings);
      await service.join(actor(2), entry.code, profile);
      const room = service.registry.byId(entry.roomId)!;
      await service.disconnect(actor(1));
      await time.advanceTo(1000 + elapsed);
      await service.sync(actor(1, 'returned'));
      expect(room.snapshot().hostPlayerId).toBe(actor(elapsed < 30000 ? 1 : 2).playerId);
    },
  );
  it('reconfere TTL e transferência mesmo com callbacks ainda não executados', async () => {
    const { service, runtime } = setup({ policy: DEFAULT_ROOM_POLICY });
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    const room = service.registry.byId(entry.roomId)!;
    await service.disconnect(actor(1));
    const clock = vi.spyOn(runtime.clock, 'now').mockReturnValue(31000);
    await service.sync(actor(1, 'new'));
    expect(room.snapshot().hostPlayerId).toBe(actor(2).playerId);
    await service.disconnect(actor(1, 'new'));
    await service.disconnect(actor(2));
    clock.mockReturnValue(151000);
    expect(await service.sync(actor(1, 'late'))).toEqual({ status: 'absent' });
    expect(service.registry.byId(room.id)).toBeUndefined();
    expect(room.snapshot().phase).toEqual({ status: 'closed', reason: 'expired' });
    clock.mockRestore();
  });
});

describe('timers e encerramento', () => {
  it('aguarda a fila ao encerrar e rejeita comandos ainda não executados', async () => {
    const { service, time } = setup();
    const entry = await service.create(actor(1), profile, settings);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = service.registry.byId(entry.roomId)!.runExclusive(() => gate);
    const update = service.updateProfile(actor(1), entry.roomId, profile);
    const rejected = expect(update).rejects.toMatchObject({ code: 'INVALID_PHASE' });
    const closing = service.dispose();
    release();
    await held;
    await rejected;
    await closing;
    expect(time.pendingCount).toBe(0);
    expect(service.registry.all()).toHaveLength(0);
  });
  it('ignora callbacks antigos após reconexão e mudança de partida', async () => {
    const { service, time } = setup();
    const tasks = vi.spyOn(time, 'scheduleAt');
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    await service.disconnect(actor(2));
    const removal = tasks.mock.calls.find(([deadline]) => deadline === 1030)![1];
    await service.join(actor(2, 'current'), entry.code, profile);
    const first = await service.start(actor(1), entry.roomId);
    await service.returnToLobby(actor(1), entry.roomId, first.matchId);
    const second = await service.start(actor(1), entry.roomId);
    const room = service.registry.byId(entry.roomId)!;
    const before = room.snapshot();
    await removal();
    expect(room.snapshot()).toEqual(before);
    await failure(
      () => service.returnToLobby(actor(1), entry.roomId, first.matchId),
      'STALE_CONTEXT',
    );
    expect(second.matchId).not.toBe(first.matchId);
    expect(room.snapshot()).toEqual(before);
  });
  it('um timer já entregue à fila não remove quem reconectou antes dele', async () => {
    const { service, time } = setup();
    const calls = vi.spyOn(time, 'scheduleAt');
    const entry = await service.create(actor(1), profile, settings);
    await service.join(actor(2), entry.code, profile);
    await service.disconnect(actor(2));
    const oldRemoval = calls.mock.calls.find(([deadline]) => deadline === 1030)![1];
    const reconnect = service.join(actor(2, 'current'), entry.code, profile);
    const oldTimer = oldRemoval();
    await reconnect;
    await oldTimer;
    expect(service.registry.byId(entry.roomId)!.snapshot().members).toHaveLength(2);
  });
  it('libera código, associações e timers ao fechar, sem atingir outra sala que reutilize o código', async () => {
    const { service, time, runtime } = setup();
    const calls = vi.spyOn(time, 'scheduleAt');
    runtime.random.integer = () => 0;
    const entry = await service.create(actor(1), profile, settings);
    const oldTimer = calls.mock.calls[0]![1];
    await service.disconnect(actor(1));
    expect(time.pendingCount).toBe(4);
    await service.close(entry.roomId);
    expect(time.pendingCount).toBe(0);
    expect(service.registry.byId(entry.roomId)).toBeUndefined();
    expect(service.registry.roomOf(actor(1).playerId)).toBeUndefined();
    const next = await service.create(actor(2), profile, settings);
    expect(next.code).toBe(entry.code);
    await oldTimer();
    expect(service.registry.byId(next.roomId)?.snapshot().stateVersion).toBe(1);
  });
  it('fecha sem membros, fecha vazia após TTL e expira por idade sem prolongar por mutação', async () => {
    const { service, time } = setup();
    const empty = await service.create(actor(1), profile, settings);
    await service.leave(actor(1), empty.roomId);
    expect(service.registry.byId(empty.roomId)).toBeUndefined();
    const absent = await service.create(actor(2), profile, settings);
    await service.join(actor(3), absent.code, profile);
    const start = await service.start(actor(2), absent.roomId);
    expect(matchIdSchema.safeParse(start.matchId).success).toBe(true);
    await service.disconnect(actor(2));
    await service.disconnect(actor(3));
    await time.advanceTo(1060);
    expect(service.registry.byId(absent.roomId)).toBeUndefined();
    const aged = await service.create(actor(4), profile, settings);
    await time.advanceTo(2059);
    await service.updateProfile(actor(4), aged.roomId, profile);
    await time.advanceTo(2060);
    expect(service.registry.byId(aged.roomId)).toBeUndefined();
  });
  it('recupera a fila se o observador falhar, fecha todas as salas e impede novas admissões', async () => {
    const onError = vi.fn();
    const { service, time } = setup({
      onChange: () => {
        throw new Error('observer');
      },
      onError,
    });
    const one = await service.create(actor(1), profile, settings);
    const two = await service.create(actor(2), profile, settings);
    expect(onError).toHaveBeenCalledTimes(2);
    await service.dispose();
    await service.dispose();
    expect(service.registry.all()).toHaveLength(0);
    expect(time.pendingCount).toBe(0);
    await failure(() => service.create(actor(3), profile, settings), 'INVALID_PHASE');
    expect(service.registry.byId(one.roomId)).toBeUndefined();
    expect(service.registry.byId(two.roomId)).toBeUndefined();
  });
  it('valida os prazos injetados', () => {
    expect(() => setup({ policy: { ...DEFAULT_ROOM_POLICY, hostTransferGraceMs: 0 } })).toThrow(
      'prazos',
    );
  });
});
