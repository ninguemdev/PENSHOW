import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDomainError, type Acknowledgement, type ClientCommand } from '@penshow/shared';
import { testStores } from '../test/fixtures';
import {
  guestId,
  matchId,
  matchView,
  option1,
  option2,
  phases,
  spectatorId,
  wagerPhases,
  wagerView,
  theftView,
  pressureView,
} from '../test/match-fixtures';
import { strings } from '../strings/pt-BR';

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(1000));
afterEach(() => vi.restoreAllMocks());
async function setup() {
  const f = testStores();
  await f.stores.session.getState().activate();
  const calls: ClientCommand[] = [];
  vi.mocked(f.realtime.command).mockImplementation(async (command) => {
    calls.push(command);
    return {
      protocolVersion: 1,
      actionId: command.actionId,
      status: 'ok',
      event: command.event,
      result:
        command.event === 'answer:submit'
          ? { stateVersion: 3, acceptance: 'recorded' }
          : { stateVersion: 3 },
    } as Acknowledgement;
  });
  const publish = (view = matchView()) =>
    f.callbacks()!.event({ protocolVersion: 1, event: 'room:view', payload: view });
  publish();
  return { ...f, calls, publish, actions: f.stores.match.getState() };
}
describe('ações do quiz por visão autoritativa', () => {
  it.each(['answer', 'wager', 'target'] as const)(
    'limite de frequência em %s mostra erro e permite tentar de novo sem envio automático',
    async (kind) => {
      const f = await setup();
      if (kind === 'wager') f.publish(wagerView(wagerPhases().selection, 3));
      if (kind === 'target') f.publish(theftView('target', 3));
      vi.mocked(f.realtime.command).mockClear();
      vi.mocked(f.realtime.command).mockImplementationOnce(async (command) => ({
        protocolVersion: 1,
        actionId: command.actionId,
        status: 'error',
        error: createDomainError('RATE_LIMITED'),
      }));
      const act = () =>
        kind === 'answer'
          ? f.actions.answer(option1)
          : kind === 'wager'
            ? f.actions.wager(25)
            : f.actions.target(guestId);
      expect(await act()).toBe(false);
      expect(f.stores.match.getState()).toMatchObject({
        error: createDomainError('RATE_LIMITED').message,
        attempt: null,
        wagerAttempt: null,
        targetAttempt: null,
      });
      expect(f.realtime.command).toHaveBeenCalledTimes(1);
      expect(await act()).toBe(true);
      expect(f.realtime.command).toHaveBeenCalledTimes(2);
    },
  );
  it('revanche limpa tentativas após descartar view e não aceita ack atrasado da partida anterior', async () => {
    const f = await setup();
    let finish!: (ack: Acknowledgement) => void;
    let command!: ClientCommand;
    vi.mocked(f.realtime.command).mockImplementationOnce((sent) => {
      command = sent;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const pending = f.actions.answer(option1);
    expect(f.stores.match.getState().attempt?.status).toBe('sending');
    const source = matchView();
    if (source.state.status !== 'match') throw new Error();
    f.stores.room.getState().expectRoom(source.code);
    f.publish({
      ...source,
      stateVersion: 10,
      state: { status: 'lobby', settings: source.state.settings },
    });
    expect(f.stores.match.getState()).toMatchObject({
      busyKey: null,
      attempt: null,
      targetAttempt: null,
      wagerAttempt: null,
      error: null,
    });
    finish({
      protocolVersion: 1,
      actionId: command.actionId,
      status: 'ok',
      event: 'answer:submit',
      result: { stateVersion: 3, acceptance: 'recorded' },
    });
    expect(await pending).toBe(false);
    expect(f.stores.match.getState().attempt).toBeNull();
    expect(f.stores.room.getState().view?.state.status).toBe('lobby');
  });
  it('dinamite usa o comando comum, trava envio incerto e conserva placar até evento', async () => {
    const f = await setup();
    f.publish(pressureView('open', 3));
    vi.mocked(f.realtime.command).mockImplementationOnce(async (command) => {
      f.calls.push(command);
      throw new Error('Timeout');
    });
    expect(await f.actions.answer(option1)).toBe(false);
    expect(await f.actions.answer(option2)).toBe(false);
    expect(f.calls).toHaveLength(1);
    expect(f.stores.match.getState().attempt?.status).toBe('unconfirmed');
    expect(f.stores.room.getState().view).toEqual(pressureView('open', 3));
    f.publish(pressureView('reveal', 4));
    expect(f.stores.room.getState().view).toEqual(pressureView('reveal', 4));
  });
  it('alvo autorizado é enviado uma vez e timeout bloqueia nova escolha até reconciliação', async () => {
    const f = await setup();
    f.publish(theftView('target', 3));
    expect(await f.actions.target(guestId)).toBe(true);
    expect(await f.actions.target(guestId)).toBe(false);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toMatchObject({
      event: 'target:choose',
      payload: { targetPlayerId: guestId },
    });
    f.publish(theftView('target', 4));
    expect(f.stores.room.getState().view).toEqual(theftView('target', 4));
    const second = await setup();
    second.publish(theftView('target', 3));
    vi.mocked(second.realtime.command).mockRejectedValueOnce(new Error('Timeout'));
    expect(await second.actions.target(guestId)).toBe(false);
    second.actions.cancel();
    expect(await second.actions.target(guestId)).toBe(false);
    expect(second.stores.match.getState().targetAttempt?.status).toBe('unconfirmed');
  });
  it('aposta aceita fica bloqueada sem manter saldo local e sem reenvio automático', async () => {
    const f = await setup();
    f.publish(wagerView(wagerPhases().selection, 3));
    expect(await f.actions.wager(25)).toBe(true);
    expect(await f.actions.wager(50)).toBe(false);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toMatchObject({ event: 'wager:submit', payload: { amount: 25 } });
    expect(f.stores.room.getState().view).toEqual(wagerView(wagerPhases().selection, 3));
    expect(f.stores.match.getState().wagerAttempt?.status).toBe('recorded');
  });
  it('aposta incerta fica bloqueada até recuperar fotografia em outra conexão', async () => {
    const f = await setup();
    f.publish(wagerView(wagerPhases().selection, 3));
    vi.mocked(f.realtime.command).mockRejectedValueOnce(new Error('Timeout'));
    expect(await f.actions.wager(25)).toBe(false);
    expect(f.stores.match.getState().wagerAttempt?.status).toBe('unconfirmed');
    f.actions.cancel();
    expect(await f.actions.wager(50)).toBe(false);
    f.callbacks()!.status('offline');
    f.callbacks()!.status('online');
    f.publish(
      wagerView({ ...wagerPhases().selection, ownWager: { status: 'submitted', amount: 25 } }, 5),
    );
    expect(await f.actions.wager(50)).toBe(false);
  });
  it('aposta: valida saldo oferecido, etapa e prazo antes de enviar', async () => {
    const f = await setup();
    f.publish(wagerView({ ...wagerPhases().selection, allowedAmounts: [0] }, 3));
    expect(await f.actions.wager(25)).toBe(false);
    f.publish(wagerView({ ...wagerPhases().selection, deadlineAt: 1000 }, 4));
    expect(await f.actions.wager(0)).toBe(false);
    f.publish(wagerView(wagerPhases().open, 6));
    expect(await f.actions.wager(0)).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
  it('pausa controles ao sair durante a partida até recuperar a presença por conexão nova', async () => {
    const f = await setup();
    await f.stores.lobby.getState().leave();
    expect(f.stores.session.getState().viewReady).toBe(false);
    expect(await f.actions.answer(option1)).toBe(false);
    expect(f.calls.filter((command) => command.event === 'answer:submit')).toHaveLength(0);
    f.callbacks()!.status('offline');
    f.callbacks()!.status('online');
    f.publish(matchView(phases().open, 7));
    expect(await f.actions.answer(option1)).toBe(true);
  });
  it('usa serverNow como aproximação até chegar uma amostra válida do relógio', async () => {
    const f = await setup();
    f.publish({ ...matchView(phases().open, 3), serverNow: 5000 });
    expect(f.stores.session.getState().offset).toBe(4000);
    expect(f.stores.session.getState().viewReady).toBe(true);
  });
  it('descarta sincronização atrasada de uma conexão anterior', async () => {
    const f = await setup();
    const samples: {
      command: Extract<ClientCommand, { event: 'time:sync' }>;
      resolve: (ack: Acknowledgement) => void;
    }[] = [];
    vi.mocked(f.realtime.command).mockImplementation((command) => {
      if (command.event === 'room:sync')
        return Promise.resolve({
          protocolVersion: 1,
          actionId: command.actionId,
          status: 'ok',
          event: 'room:sync',
          result: { status: 'present', roomId: matchView().roomId, stateVersion: 2 },
        });
      if (command.event !== 'time:sync') throw new Error('Apenas amostras.');
      return new Promise((resolve) => {
        samples.push({ command, resolve });
      });
    });
    for (let index = 0; index < 2; index++) {
      f.callbacks()!.status('offline');
      f.callbacks()!.status('online');
    }
    const sample = (index: number, serverNow: number) => {
      const entry = samples[index]!;
      entry.resolve({
        protocolVersion: 1,
        actionId: entry.command.actionId,
        status: 'ok',
        event: 'time:sync',
        result: { clientSentAt: 1000, serverReceivedAt: serverNow, serverSentAt: serverNow },
      });
    };
    sample(0, 51000);
    await Promise.resolve();
    expect(f.stores.session.getState().offset).toBe(0);
    sample(1, 2000);
    await Promise.resolve();
    expect(f.stores.session.getState().offset).toBe(1000);
    expect(f.stores.session.getState().viewReady).toBe(false);
  });
  it('envia uma escolha imediata com os IDs da view e bloqueia reenvio inclusive após ack', async () => {
    const f = await setup();
    expect(await f.actions.answer(option2)).toBe(true);
    expect(await f.actions.answer(option1)).toBe(false);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toMatchObject({
      event: 'answer:submit',
      payload: {
        roomId: matchView().roomId,
        matchId,
        roundId: phases().open.round.roundId,
        questionId: phases().open.question.questionId,
        optionId: option2,
      },
    });
    expect(JSON.stringify(f.calls)).not.toMatch(/correct|points|token|receivedAt|playerId/);
    expect(f.stores.match.getState().attempt?.status).toBe('recorded');
    expect(f.stores.room.getState().view).toEqual(matchView());
  });
  it('bloqueia clique concorrente antes de a confirmação chegar', async () => {
    const f = await setup();
    let resolve!: (ack: Acknowledgement) => void;
    vi.mocked(f.realtime.command).mockImplementationOnce((command) => {
      f.calls.push(command);
      return new Promise((done) => {
        resolve = done;
      });
    });
    const sending = f.actions.answer(option1);
    expect(f.stores.match.getState().attempt?.status).toBe('sending');
    expect(await f.actions.answer(option2)).toBe(false);
    resolve({
      protocolVersion: 1,
      actionId: f.calls[0]!.actionId,
      status: 'ok',
      event: 'answer:submit',
      result: { stateVersion: 3, acceptance: 'recorded' },
    });
    await sending;
    expect(f.calls).toHaveLength(1);
  });
  it('mantém tentativa incerta bloqueada e só a reconexão com visão nova pode liberá-la', async () => {
    const f = await setup();
    vi.mocked(f.realtime.command).mockRejectedValueOnce(new Error(strings.errors.unconfirmed));
    expect(await f.actions.answer(option1)).toBe(false);
    expect(f.stores.match.getState().attempt?.status).toBe('unconfirmed');
    f.actions.cancel();
    expect(await f.actions.answer(option2)).toBe(false);
    f.callbacks()!.status('offline');
    f.callbacks()!.status('online');
    expect(f.stores.session.getState().viewReady).toBe(false);
    expect(await f.actions.answer(option2)).toBe(false);
    f.publish(matchView(phases().open, 4));
    expect(await f.actions.answer(option2)).toBe(true);
  });
  it('recupera resposta confirmada por view sem restaurar oportunidade após reconectar', async () => {
    const f = await setup();
    await f.actions.answer(option1);
    f.callbacks()!.status('offline');
    f.callbacks()!.status('online');
    f.publish(
      matchView(
        {
          ...phases().open,
          answeredPlayerIds: [matchView().viewerId],
          ownAnswer: { status: 'submitted', optionId: option1 },
        },
        4,
      ),
    );
    expect(await f.actions.answer(option2)).toBe(false);
    expect(f.calls.filter((command) => command.event === 'answer:submit')).toHaveLength(1);
  });
  it('erro explícito de payload permite corrigir; falha interna não repete silenciosamente', async () => {
    const f = await setup();
    vi.mocked(f.realtime.command).mockImplementationOnce(async (command) => ({
      protocolVersion: 1,
      actionId: command.actionId,
      status: 'error',
      error: createDomainError('INVALID_PAYLOAD'),
    }));
    expect(await f.actions.answer(option1)).toBe(false);
    expect(f.stores.match.getState().attempt).toBeNull();
    vi.mocked(f.realtime.command).mockImplementationOnce(async (command) => ({
      protocolVersion: 1,
      actionId: command.actionId,
      status: 'error',
      error: createDomainError('INTERNAL_ERROR'),
    }));
    expect(await f.actions.answer(option2)).toBe(false);
    expect(f.stores.match.getState().attempt?.status).toBe('unconfirmed');
    expect(await f.actions.answer(option1)).toBe(false);
  });
  it('ignora ack antigo enquanto outra pergunta já aceita uma nova escolha', async () => {
    const f = await setup();
    let reject!: (error: Error) => void;
    vi.mocked(f.realtime.command).mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const old = f.actions.answer(option1);
    f.publish(matchView(phases(2).open, 5, undefined, 2));
    expect(await f.actions.answer(option2)).toBe(true);
    reject(new Error('late error'));
    await old;
    expect(f.stores.match.getState().error).toBeNull();
    expect(f.stores.match.getState().attempt?.optionId).toBe(option2);
  });
  it('revalida horário sincronizado, fase, papel, conexão e alternativa antes de emitir', async () => {
    const f = await setup();
    f.stores.session.setState({ offset: 15000 });
    expect(await f.actions.answer(option1)).toBe(false);
    f.stores.session.setState({ offset: 0 });
    f.publish(matchView(phases().reading, 3));
    expect(await f.actions.answer(option1)).toBe(false);
    f.publish(matchView(phases().open, 4));
    f.stores.session.setState({ connection: 'offline' });
    expect(await f.actions.answer(option1)).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
  it('recusa espectador, pergunta já respondida e escolha de tema alheia', async () => {
    const f = await setup();
    f.stores.room.getState().reset();
    f.stores.room.getState().listen();
    f.stores.session.setState({
      session: { ...f.stores.session.getState().session!, playerId: spectatorId },
    });
    f.stores.room
      .getState()
      .receive(
        matchView({ ...phases().open, ownAnswer: { status: 'unavailable' } }, 5, spectatorId),
        spectatorId,
      );
    expect(await f.actions.answer(option1)).toBe(false);
    expect(await f.actions.ready()).toBe(false);
    expect(await f.actions.wager(0)).toBe(false);
    f.stores.room.getState().reset();
    f.stores.room.getState().listen();
    f.stores.session.setState({
      session: { ...f.stores.session.getState().session!, playerId: guestId },
    });
    f.stores.room.getState().receive(matchView(phases().category, 6, guestId), guestId);
    expect(await f.actions.chooseCategory('history')).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
  it('só confirma pronto/tema/retorno na etapa e permissão correspondentes', async () => {
    const f = await setup();
    expect(await f.actions.returnToLobby()).toBe(false);
    f.publish(matchView(phases().instructions, 3, undefined, 0));
    expect(await f.actions.ready()).toBe(true);
    f.publish(matchView(phases().category, 4, undefined, 0));
    expect(await f.actions.chooseCategory('history')).toBe(true);
    f.publish(matchView(phases().complete, 5, undefined, 6));
    expect(await f.actions.returnToLobby()).toBe(true);
    expect(f.calls.map((command) => command.event)).toEqual([
      'round:ready',
      'category:choose',
      'match:returnToLobby',
    ]);
    expect(f.stores.room.getState().view?.state.status).toBe('match');
  });
});
