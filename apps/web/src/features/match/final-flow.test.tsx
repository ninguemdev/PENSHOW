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
import { issuedSession, profile, testStores } from '../../test/fixtures';
import {
  guestId,
  hostId,
  option1,
  phases,
  spectatorId,
  round,
  matchView,
} from '../../test/match-fixtures';
import { finalPhases, finalView, thirdId } from '../../test/final-fixtures';

beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(1000));
afterEach(() => vi.restoreAllMocks());
async function harness(view = finalView()) {
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
          ? { stateVersion: 100, acceptance: 'first-valid' }
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

describe('interface da final', () => {
  it('pódio segue sobrevivente e eliminações, mostra histórico por fase e prepara revanche pelo servidor', async () => {
    const open = finalPhases().open;
    const podium = finalView(
      {
        phase: 'podium',
        round: open.round,
        finalists: open.finalists.map((player) =>
          player.playerId === thirdId
            ? player
            : {
                ...player,
                lives: 0,
                status: 'eliminated',
                eliminationOrder: player.playerId === hostId ? 2 : 1,
              },
        ),
        standings: [thirdId, hostId, guestId],
      },
      3,
    );
    if (podium.state.status !== 'match') throw new Error();
    podium.state.match.roundSummaries = [
      {
        round,
        status: 'completed',
        questionsPlayed: 6,
        players: podium.state.match.scoreboard.map((score) => ({
          playerId: score.playerId,
          pointsBefore: 0,
          pointsAfter: score.points,
          pointsDelta: score.points,
          correctAnswers: score.correctAnswers,
        })),
      },
    ];
    const f = await harness(finalView(finalPhases().target));
    await userEvent.click(
      f.ui.getByRole('button', { name: strings.final.attack('Bruno', 4, false) }),
    );
    expect(f.stores.match.getState().targetAttempt).not.toBeNull();
    f.push(podium);
    expect(f.ui.getByRole('heading', { name: strings.results.title })).toBe(document.activeElement);
    expect(f.ui.getByText(strings.final.winner('Dani'))).toBeDefined();
    const rows = within(f.ui.getByRole('list', { name: strings.results.order })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Dani'),
      expect.stringContaining('Joana'),
      expect.stringContaining('Bruno'),
    ]);
    expect(f.ui.getByRole('heading', { name: strings.results.historical })).toBeDefined();
    expect(f.ui.getByText(strings.results.score(0, 600, 600, 6), { exact: false })).toBeDefined();
    expect(f.ui.queryByRole('button', { name: /Atacar/ })).toBeNull();
    await userEvent.click(f.ui.getByRole('button', { name: strings.results.rematch }));
    expect(f.commands.at(-1)?.event).toBe('match:returnToLobby');
    expect(f.stores.room.getState().view).toEqual(podium);
    f.push({
      ...podium,
      stateVersion: 4,
      state: { status: 'lobby', settings: podium.state.settings },
    });
    expect(f.ui.queryByRole('heading', { name: strings.results.title })).toBeNull();
    expect(f.stores.match.getState()).toMatchObject({
      attempt: null,
      targetAttempt: null,
      wagerAttempt: null,
      busyKey: null,
      error: null,
    });
    expect(f.stores.profile.getState().profile).toEqual(profile);
    f.push(matchView(phases().instructions, 5));
    expect(f.ui.getByText(strings.match.readyCount(0, 2))).toBeDefined();
    expect(f.ui.queryByRole('heading', { name: strings.results.history })).toBeNull();
  });

  it.each([guestId, spectatorId])(
    'pódio de %s não oferece revanche a quem não é anfitrião',
    async (viewer) => {
      const open = finalPhases().open;
      const f = await harness(
        finalView(
          {
            phase: 'podium',
            round: open.round,
            finalists: open.finalists.map((player) =>
              player.playerId === hostId
                ? player
                : {
                    ...player,
                    lives: 0,
                    status: 'eliminated',
                    eliminationOrder: player.playerId === guestId ? 1 : 2,
                  },
            ),
            standings: [hostId, thirdId, guestId],
          },
          2,
          viewer,
        ),
      );
      expect(f.ui.queryByRole('button', { name: strings.results.rematch })).toBeNull();
      expect(f.ui.getByText(strings.match.waitHost)).toBeDefined();
    },
  );

  it('interrupção preserva histórico sem mostrar pódio nem campeão', async () => {
    const f = await harness(finalView({ phase: 'interrupted', reason: 'insufficient-questions' }));
    expect(f.ui.getByRole('heading', { name: strings.match.interrupted })).toBeDefined();
    expect(f.ui.queryByRole('list', { name: strings.results.order })).toBeNull();
    expect(f.ui.queryByText(/venceu a final/)).toBeNull();
  });
  it('inicia pela classificação congelada, mostra conversão e envia pronto no contexto da final', async () => {
    const f = await harness(finalView(phases().complete));
    expect(f.ui.getByText(strings.final.allocation('Joana', 1, 600, 5))).toBeDefined();
    await userEvent.click(f.ui.getByRole('button', { name: strings.final.start }));
    expect(f.commands.at(-1)?.event).toBe('final:start');
    f.push(finalView(finalPhases().instructions, 3));
    expect(f.ui.getByText(strings.final.rules(15000, 6000))).toBeDefined();
    await userEvent.click(f.ui.getByRole('button', { name: strings.match.ready }));
    expect(f.commands.at(-1)).toMatchObject({
      event: 'round:ready',
      payload: { roundId: finalPhases().instructions.round.roundId },
    });
    f.push(finalView(finalPhases().reading, 4));
    expect(f.ui.queryByRole('button', { name: 'Alternativa Alfa' })).toBeNull();
  });
  it('não anuncia prioridade ao clicar; confirma só pelo ack e conserva vidas até a projeção', async () => {
    const f = await harness();
    let resolve!: (ack: Acknowledgement) => void;
    let sent!: ClientCommand;
    vi.mocked(f.realtime.command).mockImplementationOnce((command) => {
      sent = command;
      return new Promise((done) => {
        resolve = done;
      });
    });
    await userEvent.click(f.ui.getByRole('button', { name: 'Alternativa Alfa' }));
    expect(f.ui.getByText(strings.match.sending)).toBeDefined();
    expect(f.ui.queryByText(strings.final.accepted)).toBeNull();
    expect(f.ui.getByRole('list', { name: strings.final.lives }).textContent).toContain(
      '5 de 5 vidas',
    );
    await act(async () =>
      resolve({
        protocolVersion: 1,
        actionId: sent.actionId,
        status: 'ok',
        event: 'answer:submit',
        result: { stateVersion: 3, acceptance: 'first-valid' },
      }),
    );
    expect(f.ui.getByText(strings.final.accepted)).toBeDefined();
    expect(
      f.ui
        .getAllByRole('button', { name: /Alternativa/ })
        .every((button) => button.hasAttribute('disabled')),
    ).toBe(true);
    f.push(finalView(finalPhases().wrong, 3));
    expect(f.ui.getByText(strings.final.wrong('Joana'))).toBeDefined();
    expect(f.ui.getByText(strings.final.loss('Joana', 5, 4))).toBeDefined();
    expect(f.ui.queryByRole('button', { name: 'Alternativa Alfa' })).toBeNull();
  });
  it('resposta rejeitada não é sucesso nem envio incerto; timeout permite recuperar o estado', async () => {
    const f = await harness();
    vi.mocked(f.realtime.command).mockImplementationOnce(async (command) => ({
      protocolVersion: 1,
      actionId: command.actionId,
      status: 'error',
      error: createDomainError('QUESTION_CLOSED'),
    }));
    await userEvent.click(f.ui.getByRole('button', { name: 'Alternativa Alfa' }));
    expect(f.ui.getByText(strings.final.rejected)).toBeDefined();
    expect(f.ui.queryByText(strings.final.accepted)).toBeNull();
    expect(await f.stores.match.getState().answer(option1)).toBe(false);
    f.unmount();
    const uncertain = await harness();
    vi.mocked(uncertain.realtime.command).mockRejectedValueOnce(new Error('Timeout'));
    await userEvent.click(uncertain.ui.getByRole('button', { name: 'Alternativa Alfa' }));
    expect(uncertain.ui.getByText(strings.match.uncertain)).toBeDefined();
    expect(uncertain.ui.getByRole('button', { name: strings.match.recover })).toBeDefined();
    expect(uncertain.ui.queryByText(strings.final.accepted)).toBeNull();
  });
  it('recupera alvo e prazo, permite atacar adversário offline e não calcula dano local', async () => {
    const view = finalView(finalPhases().target);
    view.members[1]!.connection = { status: 'disconnected', since: 500 };
    const f = await harness(view);
    expect(f.ui.getByText(strings.final.first('Joana'))).toBeDefined();
    const button = f.ui.getByRole('button', { name: strings.final.attack('Bruno', 4, true) });
    button.focus();
    await userEvent.keyboard('[Enter]');
    expect(f.commands.at(-1)).toMatchObject({
      event: 'target:choose',
      payload: {
        questionId: finalPhases().target.reveal.question.questionId,
        targetPlayerId: guestId,
      },
    });
    expect(JSON.stringify(f.commands.at(-1))).not.toMatch(/"damage"|"lives"|"amount"/);
    expect(f.ui.getByRole('list', { name: strings.final.lives }).textContent).toContain(
      '4 de 4 vidas',
    );
  });
  it.each([guestId, spectatorId])(
    'somente o autor escolhe alvo; %s acompanha sem controles',
    async (viewer) => {
      const f = await harness(finalView(finalPhases().target, 2, viewer));
      expect(f.ui.queryByRole('button', { name: /Atacar/ })).toBeNull();
      expect(await f.stores.match.getState().target(hostId)).toBe(false);
      expect(f.commands).toHaveLength(0);
    },
  );
  it('eliminado acompanha pergunta e alvo após reconectar, sem controles de ação', async () => {
    const open = finalPhases().open;
    const finalists = open.finalists.map((player) =>
      player.playerId === guestId
        ? { ...player, lives: 0 as const, status: 'eliminated' as const, eliminationOrder: 1 }
        : player,
    );
    const f = await harness(finalView({ ...open, finalists }, 2, guestId));
    expect(f.ui.getByText(strings.final.watching)).toBeDefined();
    expect(f.ui.queryByRole('button', { name: /Alternativa/ })).toBeNull();
    expect(await f.stores.match.getState().answer(option1)).toBe(false);
    const target = finalPhases().target;
    f.push(
      finalView(
        {
          ...target,
          finalists,
          eligibleTargetIds: target.eligibleTargetIds.filter((id) => id !== guestId),
        },
        3,
        guestId,
      ),
    );
    expect(f.ui.queryByRole('button', { name: /Atacar/ })).toBeNull();
  });
  it('informa eliminação e perda em texto, encerra pergunta e mantém foco na etapa', async () => {
    const wrong = finalPhases().wrong;
    const f = await harness();
    f.push(
      finalView(
        {
          ...wrong,
          finalists: wrong.finalists.map((player) =>
            player.playerId === hostId
              ? { ...player, lives: 0, status: 'eliminated', eliminationOrder: 1 }
              : player,
          ),
        },
        3,
      ),
    );
    expect(f.ui.getByText(strings.final.loss('Joana', 1, 0))).toBeDefined();
    expect(f.ui.getByText(strings.final.elimination('Joana'))).toBeDefined();
    expect(f.ui.getByText(strings.final.closed)).toBeDefined();
    expect(f.container.contains(document.activeElement)).toBe(true);
  });
  it.each(['noAnswer', 'noTarget'] as const)(
    'expõe pausa %s e retorno ao lobby sem inventar dano',
    async (phase) => {
      const f = await harness(finalView(finalPhases()[phase]));
      expect(f.ui.getByRole('heading', { name: strings.final.paused })).toBeDefined();
      expect(f.ui.queryByRole('button', { name: /Alternativa|Atacar/ })).toBeNull();
      await userEvent.click(f.ui.getByRole('button', { name: strings.match.return }));
      expect(f.commands.at(-1)?.event).toBe('match:returnToLobby');
    },
  );
});
