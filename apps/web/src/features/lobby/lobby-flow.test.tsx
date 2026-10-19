import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acknowledgementSchema,
  createDomainError,
  playerIdSchema,
  roomViewSchema,
} from '@penshow/shared';
import { App } from '../../app';
import { strings } from '../../strings/pt-BR';
import { issuedSession, profile, roomView, testStores } from '../../test/fixtures';
import { InvitePanel } from './invite-panel';

beforeEach(() => window.history.replaceState(null, '', '/'));
function connectedLobby(host = true, spectator = false) {
  const f = testStores();
  f.stores.profile.getState().save(profile);
  const view = roomViewSchema.parse(
    host
      ? roomView
      : {
          ...roomView,
          members: [
            {
              ...roomView.members[0]!,
              playerId: playerIdSchema.parse('10000000-0000-4000-8000-000000000002'),
              profile: { ...profile, nickname: 'Ana' },
            },
            {
              ...roomView.members[0]!,
              isHost: false,
              role: spectator ? ('spectator' as const) : ('player' as const),
            },
          ],
        },
  );
  vi.mocked(f.realtime.command).mockImplementation(async (command) => {
    if (command.event === 'time:sync') throw new Error('No clock sample');
    const published =
      command.event === 'room:create' || command.event === 'room:join'
        ? {
            ...view,
            members: view.members.map((member) =>
              member.playerId === view.viewerId
                ? { ...member, profile: command.payload.profile }
                : member,
            ),
          }
        : view;
    f.callbacks()?.event({ protocolVersion: 1, event: 'room:view', payload: published });
    return acknowledgementSchema.parse({
      protocolVersion: 1,
      actionId: command.actionId,
      status: 'ok',
      event: command.event,
      result: {
        roomId: view.roomId,
        code: view.code,
        playerId: issuedSession.playerId,
        stateVersion: 1,
      },
    });
  });
  return { ...f, view };
}

describe('formar o grupo pela interface', () => {
  it('preserva criação ao preparar o perfil e só cria sessão/sala por ação explícita', async () => {
    const f = connectedLobby();
    f.stores.profile.getState().clear();
    render(<App stores={f.stores} />);
    await screen.findByText(strings.connection.idle);
    await userEvent.click(screen.getByRole('link', { name: strings.homePage.create }));
    expect(window.location.pathname).toBe('/criar');
    expect(screen.getByRole('button', { name: strings.homePage.create }).matches(':disabled')).toBe(
      true,
    );
    expect(f.http.createSession).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('link', { name: strings.homePage.prepare }));
    expect(new URLSearchParams(window.location.search).get('next')).toBe('/criar');
    await userEvent.type(screen.getByRole('textbox', { name: strings.profile.nickname }), 'Joana');
    await userEvent.click(screen.getByRole('button', { name: strings.profile.save }));
    expect(window.location.pathname).toBe('/criar');
    await userEvent.click(screen.getByRole('button', { name: strings.homePage.create }));
    await screen.findByRole('heading', { name: strings.room.members });
    expect(window.location.pathname).toBe('/sala/ABCDEF');
    expect(screen.getByText(profile.nickname)).toBeDefined();
    expect(screen.getByText(strings.player.host)).toBeDefined();
    expect(screen.queryByRole('button', { name: strings.room.updateProfile })).toBe(null);
    expect(screen.getByRole('button', { name: strings.room.start }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByText(strings.room.needPlayers)).toBeDefined();
    expect(f.http.createSession).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('link', { name: strings.home }));
    expect(screen.getByRole('link', { name: strings.room.return })).toBeDefined();
    await userEvent.click(screen.getByRole('link', { name: strings.room.return }));
    expect(screen.getByRole('heading', { name: strings.room.members })).toBeDefined();
  });
  it('normaliza código do início e mantém o convite ao salvar o perfil', async () => {
    const f = connectedLobby(false);
    f.stores.profile.getState().clear();
    render(<App stores={f.stores} />);
    await screen.findByText(strings.connection.idle);
    const input = screen.getByRole('textbox', { name: strings.room.codeLabel });
    await userEvent.type(input, 'AB0');
    await userEvent.click(screen.getByRole('button', { name: strings.room.open }));
    expect(screen.getByRole('alert').textContent).toBe(strings.room.codeError);
    expect(document.activeElement).toBe(input);
    await userEvent.clear(input);
    await userEvent.type(input, 'ab cd ef');
    await userEvent.click(screen.getByRole('button', { name: strings.room.open }));
    expect(window.location.pathname).toBe('/sala/ABCDEF');
    await userEvent.click(screen.getByRole('link', { name: strings.homePage.prepare }));
    expect(new URLSearchParams(window.location.search).get('next')).toBe('/sala/ABCDEF');
    await userEvent.type(screen.getByRole('textbox', { name: strings.profile.nickname }), 'Joana');
    await userEvent.click(screen.getByRole('button', { name: strings.profile.save }));
    await userEvent.click(screen.getByRole('button', { name: strings.room.enter }));
    await screen.findByRole('heading', { name: strings.room.members });
    expect(screen.queryByRole('button', { name: strings.room.saveSettings })).toBe(null);
    expect(screen.queryByRole('button', { name: strings.room.start })).toBe(null);
    act(() =>
      f.callbacks()?.event({
        protocolVersion: 1,
        event: 'room:view',
        payload: {
          ...f.view,
          stateVersion: 2,
          members: f.view.members.map((member, index) =>
            index === 0
              ? { ...member, connection: { status: 'disconnected', since: 1000 } }
              : member,
          ),
        },
      }),
    );
    expect(screen.getByText(strings.player.disconnected)).toBeDefined();
    expect(screen.queryByRole('button', { name: strings.room.kick('Ana') })).toBe(null);
  });
  it('representa espectador recebido sem disponibilizar ações administrativas', async () => {
    window.history.replaceState(null, '', '/sala/ABCDEF');
    const f = connectedLobby(false, true);
    render(<App stores={f.stores} />);
    await screen.findByText(strings.connection.idle);
    await userEvent.click(screen.getByRole('button', { name: strings.room.enter }));
    await screen.findByText(strings.room.spectator);
    expect(screen.getByText(strings.player.spectator)).toBeDefined();
    expect(screen.getAllByText(strings.player.connected)).toHaveLength(2);
    expect(screen.queryByRole('checkbox')).toBe(null);
    expect(screen.queryByRole('button', { name: strings.room.start })).toBe(null);
  });
  it('valida preferências antes de enviar', async () => {
    window.history.replaceState(null, '', '/criar');
    const f = connectedLobby();
    render(<App stores={f.stores} />);
    await screen.findByText(strings.connection.idle);
    for (const checkbox of screen.getAllByRole('checkbox')) await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('button', { name: strings.homePage.create }));
    expect(screen.getByRole('alert').textContent).toBe(strings.room.settingsError);
    expect(f.http.createSession).not.toHaveBeenCalled();
  });
  it.each(['ROOM_NOT_FOUND', 'ROOM_FULL'] as const)(
    'mostra %s e permite voltar ao início',
    async (code) => {
      window.history.replaceState(null, '', '/sala/ABCDEF');
      const f = connectedLobby();
      vi.mocked(f.realtime.command).mockImplementation(async (command) =>
        acknowledgementSchema.parse({
          protocolVersion: 1,
          actionId: command.actionId,
          status: 'error',
          error: createDomainError(code),
        }),
      );
      render(<App stores={f.stores} />);
      await screen.findByText(strings.connection.idle);
      await userEvent.click(screen.getByRole('button', { name: strings.room.enter }));
      expect((await screen.findByRole('alert')).textContent).toBe(createDomainError(code).message);
      expect(screen.queryByRole('heading', { name: strings.room.members })).toBe(null);
      await userEvent.click(screen.getByRole('link', { name: strings.error.back }));
      expect(window.location.pathname).toBe('/');
    },
  );
  it('mostra remoção e permite abrir outro convite preservando a sessão', async () => {
    window.history.replaceState(null, '', '/sala/ABCDEF');
    const f = connectedLobby();
    render(<App stores={f.stores} />);
    await screen.findByText(strings.connection.idle);
    await userEvent.click(screen.getByRole('button', { name: strings.room.enter }));
    await screen.findByRole('heading', { name: strings.room.members });
    act(() =>
      f.callbacks()?.event({
        protocolVersion: 1,
        event: 'room:removed',
        payload: { roomId: roomView.roomId, stateVersion: 2, reason: 'kicked' },
      }),
    );
    expect(screen.getByText(strings.room.removed.kicked)).toBeDefined();
    expect(f.stores.session.getState().session?.playerId).toBe(issuedSession.playerId);
    await userEvent.click(screen.getByRole('link', { name: strings.error.back }));
    await userEvent.type(screen.getByRole('textbox', { name: strings.room.codeLabel }), 'BCDEFG');
    await userEvent.click(screen.getByRole('button', { name: strings.room.open }));
    expect(screen.getByRole('button', { name: strings.room.enter }).hasAttribute('disabled')).toBe(
      false,
    );
  });
  it('permite entrar novamente após saída voluntária e não reabre diálogo antigo', async () => {
    window.history.replaceState(null, '', '/sala/ABCDEF');
    const f = connectedLobby();
    render(<App stores={f.stores} />);
    await screen.findByText(strings.connection.idle);
    await userEvent.click(screen.getByRole('button', { name: strings.room.enter }));
    await screen.findByRole('heading', { name: strings.room.members });
    await userEvent.click(screen.getByRole('button', { name: strings.room.leave }));
    act(() =>
      f.callbacks()?.event({
        protocolVersion: 1,
        event: 'room:removed',
        payload: { roomId: roomView.roomId, stateVersion: 2, reason: 'left' },
      }),
    );
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(screen.getByText(strings.room.removed.left)).toBeDefined();
    vi.mocked(f.realtime.command).mockImplementation(async (command) => {
      f.callbacks()?.event({
        protocolVersion: 1,
        event: 'room:view',
        payload: { ...roomView, stateVersion: 3 },
      });
      return acknowledgementSchema.parse({
        protocolVersion: 1,
        actionId: command.actionId,
        status: 'ok',
        event: 'room:join',
        result: {
          roomId: roomView.roomId,
          code: roomView.code,
          playerId: issuedSession.playerId,
          stateVersion: 3,
        },
      });
    });
    await userEvent.click(screen.getByRole('button', { name: strings.room.enter }));
    await screen.findByRole('heading', { name: strings.room.members });
    expect(screen.queryByRole('dialog')).toBe(null);
  });
  it('confirma saída e mantém o diálogo aberto quando o servidor rejeita', async () => {
    window.history.replaceState(null, '', '/sala/ABCDEF');
    const f = connectedLobby();
    render(<App stores={f.stores} />);
    await screen.findByText(strings.connection.idle);
    await userEvent.click(screen.getByRole('button', { name: strings.room.enter }));
    await screen.findByRole('heading', { name: strings.room.members });
    vi.mocked(f.realtime.command).mockImplementation(async (command) =>
      acknowledgementSchema.parse({
        protocolVersion: 1,
        actionId: command.actionId,
        status: 'error',
        error: createDomainError('FORBIDDEN'),
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: strings.room.leave }));
    const dialog = screen.getByRole('dialog', { name: strings.room.leaveTitle });
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: strings.room.stay }),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: strings.room.leave }));
    await within(dialog).findByRole('alert');
    expect(window.location.pathname).toBe('/sala/ABCDEF');
    expect(dialog.hasAttribute('open')).toBe(true);
  });
});

describe('convite', () => {
  it('oferece o endereço selecionado quando a área de transferência é recusada', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<InvitePanel code="ABCDEF" />);
    await userEvent.click(screen.getByRole('button', { name: strings.room.copy }));
    await screen.findByText(strings.room.copyFallback);
    const input = screen.getByRole('textbox', {
      name: strings.room.inviteLabel,
    }) as HTMLInputElement;
    expect(input.value).toBe(`${window.location.origin}/sala/ABCDEF`);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });
  it('confirma cópia apenas após sucesso', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<InvitePanel code="ABCDEF" />);
    await userEvent.click(screen.getByRole('button', { name: strings.room.copy }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/sala/ABCDEF`),
    );
    await screen.findByText(strings.room.copied);
  });
});
