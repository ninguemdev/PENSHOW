import { act, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDomainError,
  type Acknowledgement,
  type ClientCommand,
  type RoomView,
} from '@penshow/shared';
import { RoomPage } from '../lobby/room-page';
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
      matchView({ ...phases().open, round: { ...phases().open.round, mode: 'speed', index: 2 } }),
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
