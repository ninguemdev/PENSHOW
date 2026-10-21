import { act, fireEvent, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDomainError,
  type Acknowledgement,
  type ClientCommand,
  type RoomView,
} from '@penshow/shared';
import { RoomPage } from '../lobby/room-page';
import { Dialog } from '../../ui/dialog';
import { strings } from '../../strings/pt-BR';
import { testStores, issuedSession, profile } from '../../test/fixtures';
import {
  guestId,
  hostId,
  matchId,
  matchView,
  option1,
  option2,
  phases,
  spectatorId,
  zeroScores,
  wagerPhases,
  wagerView,
  theftView,
  pressureView,
} from '../../test/match-fixtures';

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(1000));
afterEach(() => vi.restoreAllMocks());
async function harness(view = matchView()) {
  const f = testStores();
  f.stores.profile.getState().save(profile);
  vi.mocked(f.http.createSession).mockResolvedValue({ ...issuedSession, playerId: view.viewerId });
  await f.stores.session.getState().activate();
  const commands: ClientCommand[] = [];
  vi.mocked(f.realtime.command).mockImplementation(async (command) => {
    commands.push(command);
    return {
      protocolVersion: 1,
      actionId: command.actionId,
      status: 'ok',
      event: command.event,
      result:
        command.event === 'answer:submit'
          ? { stateVersion: 100, acceptance: 'recorded' }
          : command.event === 'match:start'
            ? { matchId, stateVersion: 100 }
            : { stateVersion: 100 },
    } as Acknowledgement;
  });
  function push(next: RoomView) {
    act(() => f.callbacks()!.event({ protocolVersion: 1, event: 'room:view', payload: next }));
  }
  push(view);
  const rendered = render(<RoomPage code={view.code} stores={f.stores} />);
  return { ...f, ...rendered, commands, push, ui: within(rendered.container) };
}

describe('telas do quiz clássico', () => {
  it('ignora composição, repetição e teclas sem alternativa em perguntas booleanas', async () => {
    const source = phases().open;
    const f = await harness(
      matchView({
        ...source,
        question: {
          ...source.question,
          type: 'boolean',
          options: source.question.options.slice(0, 2),
        },
      }),
    );
    const heading = f.ui.getByRole('heading', { name: source.question.prompt });
    fireEvent.keyDown(heading, { key: '1', repeat: true });
    fireEvent.keyDown(heading, { key: '2', isComposing: true });
    await userEvent.keyboard('34');
    expect(f.commands).toHaveLength(0);
    await userEvent.keyboard('2');
    expect(f.commands).toHaveLength(1);
    expect(f.commands[0]).toMatchObject({ event: 'answer:submit', payload: { optionId: option2 } });
  });
  it.each(['1', '2', '3', '4'])(
    'responde com %s dentro da etapa e impede uma segunda escolha',
    async (key) => {
      const f = await harness(matchView(phases().open));
      const options = within(f.ui.getByRole('group', { name: strings.match.answer })).getAllByRole(
        'button',
      );
      const index = Number(key) - 1;
      expect(document.activeElement).toBe(
        f.ui.getByRole('heading', { name: 'Pergunta recebida 1?' }),
      );
      await userEvent.keyboard(key);
      expect(f.commands).toHaveLength(1);
      expect(f.commands[0]).toMatchObject({
        event: 'answer:submit',
        payload: { optionId: phases().open.question.options[index]!.optionId },
      });
      expect(options[index]!.getAttribute('aria-pressed')).toBe('true');
      expect(f.ui.getByText(strings.match.recorded).closest('[role="status"]')).not.toBeNull();
      await userEvent.keyboard('1234');
      expect(f.commands).toHaveLength(1);
    },
  );
  it('não responde fora da etapa, com modificadores, em campos editáveis ou durante diálogo', async () => {
    const f = await harness(matchView(phases().open));
    f.ui.getByRole('button', { name: strings.room.leave }).focus();
    await userEvent.keyboard('1');
    const stage = f.container.querySelector('.match-stage')!;
    for (const tag of ['input', 'textarea', 'select', 'div']) {
      const field = document.createElement(tag);
      if (tag === 'div') {
        field.setAttribute('contenteditable', 'true');
        field.tabIndex = 0;
      }
      stage.append(field);
      field.focus();
      await userEvent.keyboard('1234');
      field.remove();
    }
    f.ui.getByRole('heading', { name: 'Pergunta recebida 1?' }).focus();
    await userEvent.keyboard('{Control>}1{/Control}{Alt>}2{/Alt}{Shift>}3{/Shift}');
    const modal = render(
      <Dialog open title="Ajuda" onClose={() => undefined}>
        <button>Fechar</button>
      </Dialog>,
    );
    const dialog = within(modal.container).getByRole('dialog');
    const focused = document.activeElement;
    f.push(matchView(phases(2).open, 3));
    expect(document.activeElement).toBe(focused);
    expect(dialog.contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('1234');
    expect(f.commands.filter((command) => command.event === 'answer:submit')).toHaveLength(0);
  });
  it('preserva digitação quando o estado muda e anuncia resultado sem depender de cor', async () => {
    const f = await harness(pressureView('open'));
    const field = document.createElement('input');
    f.container.append(field);
    field.focus();
    f.push(pressureView('reveal', 3));
    expect(document.activeElement).toBe(field);
    const announcement = f.container.querySelector('[data-result-announcement]')!;
    expect(announcement.getAttribute('role')).toBe('status');
    expect(announcement.textContent).toContain('Joana: −150 Explosão');
    expect(announcement.textContent).toContain(strings.match.correct);
    field.remove();
  });
  it('atalhos respeitam desconexão, prazo encerrado e espectador', async () => {
    const f = await harness(matchView(phases().open));
    act(() => f.callbacks()!.status('offline'));
    await userEvent.keyboard('1');
    act(() => f.callbacks()!.status('online'));
    f.push(matchView({ ...phases().open, opensAt: 0, deadlineAt: 1000 }, 3));
    await userEvent.keyboard('2');
    f.push(matchView({ ...phases().open, ownAnswer: { status: 'unavailable' } }, 4, spectatorId));
    await userEvent.keyboard('3');
    expect(f.commands.filter((command) => command.event === 'answer:submit')).toHaveLength(0);
  });
  it('espera por retorno é explícita e não permite ação sobre a janela encerrada', async () => {
    const view = matchView(phases().instructions);
    if (view.state.status !== 'match') throw new Error();
    view.state.match.waitingForPlayers = true;
    const f = await harness(view);
    expect(f.ui.getByText(strings.match.waitingPlayers)).toBeDefined();
    expect(f.ui.getByRole('button', { name: strings.match.ready }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(await f.stores.match.getState().ready()).toBe(false);
    expect(f.commands).toEqual([]);
  });
  it('inicia dinamite, mostra dono, ciclo e prazo, trava após envio e revela explosão com próximo turno', async () => {
    const source = pressureView('instructions');
    if (source.state.status !== 'match') throw new Error();
    const f = await harness({
      ...source,
      state: { status: 'lobby', settings: source.state.settings },
    });
    await userEvent.click(f.ui.getByRole('button', { name: strings.room.startPressure }));
    expect(f.commands[0]).toMatchObject({ event: 'match:start', payload: { mode: 'pressure' } });
    f.push(pressureView('instructions', 3));
    expect(f.ui.getByText(strings.match.pressureInstructions(300, 150, 10000, 2))).toBeDefined();
    f.push(pressureView('reading', 4));
    expect(f.ui.queryByRole('button', { name: 'Alternativa Alfa' })).toBeNull();
    f.push(pressureView('open', 5));
    expect(f.ui.getByText(strings.match.pressureOwner('Joana'))).toBeDefined();
    expect(f.ui.getByText(strings.match.pressureCycle(1, 2, 1, 4))).toBeDefined();
    expect(f.ui.getByRole('timer').textContent).toContain('10 segundos');
    const button = f.ui.getByRole('button', { name: 'Alternativa Alfa' });
    button.focus();
    await userEvent.keyboard('[Enter]');
    expect(f.commands.at(-1)).toMatchObject({
      event: 'answer:submit',
      payload: { optionId: option1 },
    });
    expect(f.ui.getByRole('button', { name: 'Alternativa Beta' }).hasAttribute('disabled')).toBe(
      true,
    );
    f.push(pressureView('reveal', 6));
    expect(f.ui.getByText(strings.match.pressureExploded)).toBeDefined();
    expect(f.ui.getByText(strings.match.pressureNext('Bruno'))).toBeDefined();
    expect(f.ui.getByText('−150 Explosão')).toBeDefined();
  });
  it.each([guestId, spectatorId])(
    'dinamite: %s acompanha dono do turno sem enviar resposta',
    async (viewer) => {
      const f = await harness(pressureView('open', 2, viewer));
      const buttons = f.ui.getAllByRole('button', { name: /Alternativa/ });
      expect(buttons.every((button) => button.hasAttribute('disabled'))).toBe(true);
      await userEvent.click(buttons[0]!);
      expect(f.commands).toHaveLength(0);
      expect(f.ui.getByText(strings.match.answered(0, 1))).toBeDefined();
    },
  );
  it('inicia roubo, oferece alvo somente ao autor e revela transferência e saldos', async () => {
    const source = matchView();
    if (source.state.status !== 'match') throw new Error();
    const f = await harness({
      ...source,
      state: { status: 'lobby', settings: source.state.settings },
    });
    await userEvent.click(f.ui.getByRole('button', { name: strings.room.startTheft }));
    expect(f.commands[0]).toMatchObject({ event: 'match:start', payload: { mode: 'theft' } });
    f.push(theftView('instructions', 3));
    expect(f.ui.getByText(strings.match.theftInstructions(100, 50, 6000))).toBeDefined();
    f.push(theftView('target', 4));
    const button = f.ui.getByRole('button', { name: strings.match.theftTarget('Bruno', 100) });
    button.focus();
    await userEvent.keyboard('[Enter]');
    expect(f.commands.at(-1)).toMatchObject({
      event: 'target:choose',
      payload: { targetPlayerId: guestId },
    });
    expect(JSON.stringify(f.commands.at(-1))).not.toMatch(/"amount"|"damage"|"points"/);
    f.push(theftView('reveal', 5));
    expect(f.ui.getByText(strings.match.theftTransfer('Joana', 'Bruno', 50))).toBeDefined();
    expect(
      f.ui.getByText(strings.match.theftBalance(0, 100, -50, 50), { exact: false }),
    ).toBeDefined();
    expect(f.ui.getByText('−50 Roubo')).toBeDefined();
  });
  it('outro jogador ou espectador acompanha o alvo sem poder escolher', async () => {
    const guest = await harness(theftView('target', 2, guestId));
    expect(guest.ui.queryByRole('button', { name: /Roubar de/ })).toBeNull();
    const spectator = await harness(theftView('target', 2, spectatorId));
    expect(spectator.ui.queryByRole('button', { name: /Roubar de/ })).toBeNull();
  });
  it('inicia aposta pelo anfitrião, confirma escolha por teclado e revela ganho/perda individuais', async () => {
    const source = matchView();
    if (source.state.status !== 'match') throw new Error();
    const f = await harness({
      ...source,
      state: { status: 'lobby', settings: source.state.settings },
    });
    await userEvent.click(f.ui.getByRole('button', { name: strings.room.startWager }));
    expect(f.commands[0]).toMatchObject({ event: 'match:start', payload: { mode: 'wager' } });
    f.push(wagerView(wagerPhases().instructions, 3));
    expect(f.ui.getByText(strings.match.wagerInstructions(100, 6000))).toBeDefined();
    f.push(wagerView(wagerPhases().selection, 4));
    expect(f.ui.queryByText('Pergunta recebida 1?')).toBeNull();
    expect(f.ui.getByText(strings.match.wagerBalance(50))).toBeDefined();
    const button = f.ui.getByRole('button', { name: strings.match.wagerButton(25) });
    button.focus();
    await userEvent.keyboard('[Enter]');
    expect(f.commands.at(-1)).toMatchObject({ event: 'wager:submit', payload: { amount: 25 } });
    expect(JSON.stringify(f.commands.at(-1))).not.toMatch(/pointsAtSelection|playerId|balance/);
    expect(f.ui.getByText(strings.match.wagerRecorded(25))).toBeDefined();
    expect(f.ui.getByText(strings.match.wagerBalance(50))).toBeDefined();
    expect(
      f.ui
        .getAllByRole('button', { name: /Apostar/ })
        .every((item) => item.hasAttribute('disabled')),
    ).toBe(true);
    f.push(wagerView(wagerPhases().reading, 5));
    expect(f.ui.getByText(strings.match.wagerOwn(25))).toBeDefined();
    f.push(wagerView(wagerPhases().open, 6));
    await userEvent.click(f.ui.getByRole('button', { name: 'Alternativa Alfa' }));
    f.push(wagerView(wagerPhases().reveal, 7));
    expect(f.ui.getByText(strings.match.wagerResult(25, 50, 175), { exact: false })).toBeDefined();
    expect(f.ui.getByText(strings.match.wagerResult(50, 50, 0), { exact: false })).toBeDefined();
    expect(f.ui.getByText('−50 Aposta')).toBeDefined();
  });
  it('aposta recuperada fica bloqueada, saldo limita opções e espectador não aposta', async () => {
    const f = await harness(
      wagerView({
        ...wagerPhases().selection,
        allowedAmounts: [0, 25],
        ownWager: { status: 'submitted', amount: 25 },
      }),
    );
    expect(f.ui.getByText(strings.match.wagerRecorded(25))).toBeDefined();
    expect(f.ui.queryByRole('button', { name: strings.match.wagerButton(50) })).toBeNull();
    expect(
      f.ui.getByRole('button', { name: strings.match.wagerButton(25) }).hasAttribute('disabled'),
    ).toBe(true);
    const spectator = await harness(
      wagerView(
        { ...wagerPhases().selection, allowedAmounts: [0], ownWager: { status: 'unavailable' } },
        2,
        spectatorId,
      ),
    );
    expect(spectator.ui.queryByRole('button', { name: /Apostar/ })).toBeNull();
  });
  it('inicia velocidade pelo lobby e explica faixas recebidas, com base, bônus e total na revelação', async () => {
    const source = matchView();
    if (source.state.status !== 'match') throw new Error();
    const f = await harness({
      ...source,
      state: { status: 'lobby', settings: source.state.settings },
    });
    await userEvent.click(f.ui.getByRole('button', { name: strings.room.startSpeed }));
    expect(f.commands[0]).toMatchObject({ event: 'match:start', payload: { mode: 'speed' } });
    function speedView(stage: Parameters<typeof matchView>[0], version: number) {
      const view = matchView(stage, version, hostId, stage?.phase === 'instructions' ? 0 : 1);
      if (view.state.status !== 'match' || !('round' in view.state.match.stage)) throw new Error();
      view.state.match.stage.round = { ...phases().open.round, mode: 'speed', index: 2 };
      // Deliberately use values other than the defaults: UI must consume server parameters.
      view.state.match.speedRules = {
        correctPoints: 175,
        responseMs: 12000,
        bonusBands: [
          { beforeMs: 4000, points: 60 },
          { beforeMs: 12000, points: 0 },
        ],
      };
      return view;
    }
    f.push(speedView(phases().instructions, 3));
    expect(f.ui.getByText(strings.match.speedBase(175))).toBeDefined();
    expect(f.ui.getByText(strings.match.speedBand(0, 4000, 60))).toBeDefined();
    f.push(speedView(phases().open, 4));
    await userEvent.click(f.ui.getByRole('button', { name: 'Alternativa Alfa' }));
    const command = f.commands.at(-1)!;
    expect(command).toMatchObject({ event: 'answer:submit', payload: { optionId: option1 } });
    expect(JSON.stringify(command)).not.toMatch(/points|receivedAt|correct/);
    const revealed = speedView(
      {
        ...phases().reveal,
        effects: [
          { kind: 'credit', playerId: hostId, amount: 175, reason: 'correct-answer' },
          { kind: 'credit', playerId: hostId, amount: 60, reason: 'speed-bonus' },
        ],
      },
      5,
    );
    f.push(revealed);
    expect(
      f.ui.getByText(strings.match.speedBreakdown(175, 60, 235), { exact: false }),
    ).toBeDefined();
    expect(f.ui.getByText(/Base \+0 · Bônus \+0 · Total \+0/)).toBeDefined();
    expect(f.ui.getByText('+60 Bônus de velocidade')).toBeDefined();
  });
  it('inicia pelo anfitrião e só muda de tela quando chega a view do servidor', async () => {
    const source = matchView();
    const lobby: RoomView = {
      ...source,
      state: {
        status: 'lobby',
        settings: source.state.status === 'match' ? source.state.settings : never(),
      },
    };
    const f = await harness(lobby);
    await userEvent.click(f.ui.getByRole('button', { name: strings.room.start }));
    expect(f.commands).toHaveLength(1);
    expect(f.commands[0]!.event).toBe('match:start');
    expect(f.ui.queryByRole('heading', { name: strings.match.instructions })).toBeNull();
    f.push(matchView(phases().instructions, 3, hostId, 0));
    expect(f.ui.getByRole('heading', { name: strings.match.instructions })).toBeDefined();
    expect(f.ui.getByText(strings.match.progress(1, 1, 0, 6))).toBeDefined();
    await userEvent.click(f.ui.getByRole('button', { name: strings.match.ready }));
    f.push(matchView({ ...phases().instructions, readyPlayerIds: [hostId] }, 4, hostId, 0));
    expect(
      f.ui.getByRole('button', { name: strings.match.readySent }).hasAttribute('disabled'),
    ).toBe(true);
  });
  it('oferece temas apenas ao escolhido e não exibe alternativas durante a leitura', async () => {
    const f = await harness(matchView(phases().category, 2, guestId, 0));
    expect(f.ui.getByRole('button', { name: 'História' }).hasAttribute('disabled')).toBe(true);
    expect(f.ui.queryByText('Alternativa Alfa')).toBeNull();
    f.push(matchView(phases().reading, 3, guestId));
    expect(f.ui.getByRole('heading', { name: 'Pergunta recebida 1?' })).toBeDefined();
    expect(f.ui.getByText(strings.match.readingHelp)).toBeDefined();
    expect(f.ui.queryByRole('button', { name: 'Alternativa Alfa' })).toBeNull();
    expect(f.ui.queryByText('Explicação recebida apenas na revelação.')).toBeNull();
  });
  it('envia por teclado sem confirmação extra e mantém a escolha até a revelação', async () => {
    const f = await harness();
    const user = userEvent.setup();
    expect(document.activeElement).toBe(
      f.ui.getByRole('heading', { name: 'Pergunta recebida 1?' }),
    );
    await user.tab();
    expect(document.activeElement).toBe(f.ui.getByRole('button', { name: 'Alternativa Alfa' }));
    await user.keyboard('[Enter]');
    expect(f.commands).toHaveLength(1);
    expect(f.commands[0]).toMatchObject({ event: 'answer:submit', payload: { optionId: option1 } });
    expect(f.ui.getByText(strings.match.recorded)).toBeDefined();
    expect(
      f.ui
        .getAllByRole('button', { name: /Alternativa/ })
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
    expect(
      f.ui.getByRole('button', { name: 'Alternativa Alfa' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(f.ui.queryByText(strings.match.correct)).toBeNull();
    f.push(
      matchView(phases().reveal, 3, hostId, 1, [
        { playerId: hostId, points: 100, correctAnswers: 1 },
        zeroScores[1]!,
      ]),
    );
    expect(f.ui.getByText('Explicação recebida apenas na revelação.')).toBeDefined();
    expect(f.ui.getByText('+100 Acerto')).toBeDefined();
    const scores = within(f.ui.getByRole('table'));
    expect(scores.getByRole('row', { name: /Joana.*100.*1.*100 Acerto/ })).toBeDefined();
  });
  it('não restaura tentativa após queda e espera uma view nova antes de liberar controles', async () => {
    const f = await harness();
    await userEvent.click(f.ui.getByRole('button', { name: 'Alternativa Beta' }));
    act(() => f.callbacks()!.status('offline'));
    expect(f.ui.getByText(strings.match.offline)).toBeDefined();
    act(() => f.callbacks()!.status('online'));
    expect(f.ui.getByText(strings.match.waitingView)).toBeDefined();
    expect(f.ui.getByRole('button', { name: 'Alternativa Alfa' }).hasAttribute('disabled')).toBe(
      true,
    );
    f.push(
      matchView(
        {
          ...phases().open,
          answeredPlayerIds: [hostId],
          ownAnswer: { status: 'submitted', optionId: option2 },
        },
        5,
      ),
    );
    expect(
      f.ui.getByRole('button', { name: 'Alternativa Beta' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(f.ui.getByText(strings.match.recorded)).toBeDefined();
    expect(f.ui.getByRole('button', { name: 'Alternativa Alfa' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(f.commands.filter((command) => command.event === 'answer:submit')).toHaveLength(1);
  });
  it('mostra falha incerta e recupera o estado sem repetir a resposta automaticamente', async () => {
    const f = await harness();
    vi.mocked(f.realtime.command).mockRejectedValueOnce(new Error(strings.errors.unconfirmed));
    await userEvent.click(f.ui.getByRole('button', { name: 'Alternativa Alfa' }));
    expect(f.ui.getByRole('alert').textContent).toBe(strings.errors.unconfirmed);
    expect(f.ui.getByText(strings.match.uncertain)).toBeDefined();
    await userEvent.click(f.ui.getByRole('button', { name: strings.match.recover }));
    expect(f.ui.getByRole('button', { name: 'Alternativa Beta' }).hasAttribute('disabled')).toBe(
      true,
    );
    f.push(
      matchView(
        {
          ...phases().open,
          answeredPlayerIds: [hostId],
          ownAnswer: { status: 'submitted', optionId: option1 },
        },
        7,
      ),
    );
    expect(f.ui.getByText(strings.match.recorded)).toBeDefined();
    expect(f.ui.queryByRole('alert')).toBeNull();
    expect(
      vi
        .mocked(f.realtime.command)
        .mock.calls.filter(([command]) => command.event === 'answer:submit'),
    ).toHaveLength(1);
  });
  it('mostra espectador com alternativas indisponíveis e resultado público', async () => {
    const f = await harness(
      matchView({ ...phases().open, ownAnswer: { status: 'unavailable' } }, 2, spectatorId),
    );
    expect(f.ui.getByText(strings.match.spectator)).toBeDefined();
    expect(
      f.ui
        .getAllByRole('button', { name: /Alternativa/ })
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
    f.push(matchView(phases().reveal, 3, spectatorId));
    expect(f.ui.getByText('Explicação recebida apenas na revelação.')).toBeDefined();
    f.push(matchView(phases().complete, 4, spectatorId, 6));
    expect(f.ui.queryByRole('button', { name: strings.match.return })).toBeNull();
    expect(f.ui.getByText(strings.match.waitHost)).toBeDefined();
  });
  it('o cronômetro sincronizado bloqueia no fim e não abre uma revelação local', async () => {
    vi.mocked(Date.now).mockRestore();
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const f = await harness(matchView({ ...phases().open, deadlineAt: 3000 }));
    expect(f.ui.getByRole('timer').textContent).toContain('2 segundos');
    act(() => vi.advanceTimersByTime(2000));
    expect(f.ui.getByRole('timer').textContent).toContain('0 segundos');
    expect(f.ui.getByRole('button', { name: 'Alternativa Alfa' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(f.ui.getByText(strings.match.waitingUpdate)).toBeDefined();
    expect(f.ui.queryByText('Explicação recebida apenas na revelação.')).toBeNull();
    expect(f.commands).toHaveLength(0);
  });
  it('não oferece navegação para fase/modalidade não implementada e mantém o placar', async () => {
    const f = await harness(
      matchView({
        phase: 'ranking',
        ranking: { status: 'pending-tiebreak', decisionId: 'D06', scores: zeroScores },
      }),
    );
    expect(f.ui.getByText(strings.match.unsupported)).toBeDefined();
    expect(f.ui.queryByRole('button', { name: /Alternativa/ })).toBeNull();
    expect(f.ui.getByRole('table')).toBeDefined();
  });
  it('atravessa seis perguntas em duas sessões, com erro de envio e placar apenas por evento', async () => {
    const a = await harness(matchView(phases().reading, 2)),
      b = await harness(matchView(phases().reading, 2, guestId));
    let version = 2;
    for (let index = 1; index <= 6; index++) {
      if (index > 1) {
        a.push(matchView(phases(index).reading, ++version, hostId, index));
        b.push(matchView(phases(index).reading, version, guestId, index));
      }
      expect(a.ui.queryByRole('button', { name: 'Alternativa Alfa' })).toBeNull();
      a.push(matchView(phases(index).open, ++version, hostId, index));
      b.push(matchView(phases(index).open, version, guestId, index));
      if (index === 1) {
        vi.mocked(a.realtime.command).mockImplementationOnce(async (command) => ({
          protocolVersion: 1,
          actionId: command.actionId,
          status: 'error',
          error: createDomainError('INVALID_PAYLOAD'),
        }));
        await userEvent.click(a.ui.getByRole('button', { name: 'Alternativa Alfa' }));
        expect(a.ui.getByRole('alert').textContent).toBe(
          createDomainError('INVALID_PAYLOAD').message,
        );
      }
      await userEvent.click(a.ui.getByRole('button', { name: 'Alternativa Alfa' }));
      await userEvent.click(b.ui.getByRole('button', { name: 'Alternativa Beta' }));
      expect(a.ui.getByText(strings.match.recorded)).toBeDefined();
      expect(b.ui.getByText(strings.match.recorded)).toBeDefined();
      expect(a.ui.queryByText('+100 Acerto')).toBeNull();
      const scores = [
        { playerId: hostId, points: index * 100, correctAnswers: index },
        { playerId: guestId, points: 0, correctAnswers: 0 },
      ];
      a.push(matchView(phases(index).reveal, ++version, hostId, index, scores));
      b.push(matchView(phases(index).reveal, version, guestId, index, scores));
      for (const f of [a, b]) {
        expect(f.ui.getByText('+100 Acerto')).toBeDefined();
        expect(
          within(f.ui.getByRole('table')).getByRole('row', {
            name: new RegExp(`Joana.*${index * 100}.*${index}.*100 Acerto`),
          }),
        ).toBeDefined();
      }
    }
    for (const [f, viewer] of [
      [a, hostId],
      [b, guestId],
    ] as const) {
      f.push(matchView(phases().results, ++version, viewer, 6));
      expect(f.ui.getByRole('heading', { name: strings.match.results })).toBeDefined();
      f.push(matchView(phases().complete, ++version, viewer, 6));
      expect(f.ui.getByRole('heading', { name: strings.match.complete })).toBeDefined();
    }
    await userEvent.click(a.ui.getByRole('button', { name: strings.match.return }));
    expect(a.commands.at(-1)!.event).toBe('match:returnToLobby');
    expect(a.ui.getByRole('heading', { name: strings.match.complete })).toBeDefined();
    expect(a.commands.filter((command) => command.event === 'answer:submit')).toHaveLength(6);
    expect(b.commands.filter((command) => command.event === 'answer:submit')).toHaveLength(6);
  });
});
function never(): never {
  throw new Error('Partida esperada.');
}
