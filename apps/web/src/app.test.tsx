import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { strings } from './strings/pt-BR';
import { memoryStorage, profile, testStores } from './test/fixtures';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('navegação e recuperação', () => {
  it('mantém o conteúdo durante o carregamento e bloqueia ações remotas', () => {
    const { stores, http } = testStores();
    vi.mocked(http.health).mockReturnValue(new Promise(() => {}));
    render(<App stores={stores} />);
    expect(screen.getByRole('heading', { name: strings.tagline })).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain(strings.connection.loading);
    expect(
      screen.getByRole('button', { name: strings.session.activate }).hasAttribute('disabled'),
    ).toBe(true);
  });
  it('navega por teclado e move o foco para o título', async () => {
    const user = userEvent.setup();
    render(<App stores={testStores().stores} />);
    const link = screen.getByRole('link', { name: strings.profile.link });
    link.focus();
    await user.keyboard('{Enter}');
    expect(window.location.pathname).toBe('/perfil');
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: strings.profile.title }),
    );
    window.history.replaceState(null, '', '/');
    fireEvent.popState(window);
    expect(screen.getByRole('heading', { name: strings.tagline })).toBeDefined();
  });
  it.each(['/nao-existe', '/sala/INVALID', '/sala/%ZZ', '/erro'])(
    'oferece saída para %s',
    async (path) => {
      window.history.replaceState(null, '', path);
      render(<App stores={testStores().stores} />);
      expect(screen.getByRole('heading', { name: strings.error.title })).toBeDefined();
      await userEvent.click(screen.getByRole('link', { name: strings.error.back }));
      expect(screen.getByRole('heading', { name: strings.tagline })).toBeDefined();
    },
  );
  it('mostra sala vazia sem inventar participação', () => {
    window.history.replaceState(null, '', '/sala/ABCDEF');
    render(<App stores={testStores().stores} />);
    expect(screen.getByText(strings.room.empty)).toBeDefined();
  });
  it('permite recuperar a rede e ativar uma sessão pelo teclado', async () => {
    const { stores, http } = testStores();
    vi.mocked(http.health).mockRejectedValueOnce(new Error('offline'));
    render(<App stores={stores} />);
    const retry = await screen.findByRole('button', { name: strings.connection.retry });
    expect(
      screen.getByRole('button', { name: strings.session.activate }).hasAttribute('disabled'),
    ).toBe(true);
    expect(screen.getByRole('link', { name: strings.homePage.create }).getAttribute('href')).toBe(
      '/criar',
    );
    await userEvent.click(retry);
    const activate = screen.getByRole('button', { name: strings.session.activate });
    await waitFor(() => expect(activate.hasAttribute('disabled')).toBe(false));
    activate.focus();
    await userEvent.keyboard(' ');
    await screen.findByText(strings.connection.online);
    expect(http.createSession).toHaveBeenCalledTimes(1);
  });
  it('mantém tela legível com storage bloqueado e sessão em memória', async () => {
    const { stores } = testStores(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    render(<App stores={stores} />);
    await screen.findByText(strings.storage.unavailable);
    await userEvent.click(screen.getByRole('button', { name: strings.session.activate }));
    await screen.findByText(strings.connection.online);
  });
  it('recupera dados corrompidos e ainda permite navegar', async () => {
    const storage = memoryStorage();
    storage.values.set('penshow.profile', '{');
    render(<App stores={testStores(storage.access).stores} />);
    await screen.findByText(strings.storage.corrupt);
    await userEvent.click(screen.getByRole('link', { name: strings.profile.link }));
    expect(screen.getByText(strings.profile.empty)).toBeDefined();
    expect(storage.values.has('penshow.profile')).toBe(false);
  });
  it('verifica a sessão uma única vez em montagens do StrictMode sem duplicar emissão', async () => {
    const { stores, http, realtime } = testStores();
    const result = render(
      <StrictMode>
        <App stores={stores} />
      </StrictMode>,
    );
    await screen.findByText(strings.connection.idle);
    expect(http.createSession).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: strings.session.activate }));
    await screen.findByText(strings.connection.online);
    expect(realtime.connect).toHaveBeenCalledTimes(1);
    result.unmount();
    expect(realtime.disconnect).toHaveBeenCalled();
  });
});

describe('diálogo de perfil', () => {
  it('foca a ação segura, cancela e devolve o foco ao acionador', async () => {
    const storage = memoryStorage();
    storage.values.set('penshow.profile', JSON.stringify(profile));
    window.history.replaceState(null, '', '/perfil');
    render(<App stores={testStores(storage.access).stores} />);
    const trigger = await screen.findByRole('button', { name: strings.profile.remove });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: strings.profile.confirm });
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: strings.profile.cancel }),
    );
    await userEvent.tab({ shift: true });
    expect(document.activeElement?.textContent).toBe(strings.profile.remove);
    await userEvent.tab();
    expect(document.activeElement?.textContent).toBe(strings.profile.cancel);
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole('dialog')).toBe(null);
  });
  it('apaga o perfil confirmado e foca o título quando o botão desaparece', async () => {
    const storage = memoryStorage();
    storage.values.set('penshow.profile', JSON.stringify(profile));
    window.history.replaceState(null, '', '/perfil');
    const { stores } = testStores(storage.access);
    render(<App stores={stores} />);
    await userEvent.click(await screen.findByRole('button', { name: strings.profile.remove }));
    const buttons = screen.getAllByRole('button', { name: strings.profile.remove });
    await act(() => userEvent.click(buttons[buttons.length - 1]!));
    expect(screen.getByText(strings.profile.empty)).toBeDefined();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: strings.profile.title }),
    );
    expect(storage.values.has('penshow.profile')).toBe(false);
  });
});
