import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../app';
import { strings } from '../../strings/pt-BR';
import { memoryStorage, testStores } from '../../test/fixtures';

beforeEach(() => window.history.replaceState(null, '', '/perfil'));
describe('montagem e edição do perfil', () => {
  it('seleciona peças por teclado, remove acessório e salva nome normalizado voltando ao início', async () => {
    const storage = memoryStorage();
    const { stores } = testStores(storage.access);
    render(<App stores={stores} />);
    const head = await screen.findByRole('tab', { name: 'Cabeça' });
    head.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Olhos' }));
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Chapéu' }));
    let panel = screen.getByRole('tabpanel', { name: 'Chapéu' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Coroa' }));
    expect(stores.profile.getState().draft.avatar.hat).toBe('hat-crown');
    const none = within(panel).getByRole('button', { name: strings.avatar.none });
    none.focus();
    await userEvent.keyboard(' ');
    expect(stores.profile.getState().draft.avatar.hat).toBe(null);
    await userEvent.click(screen.getByRole('tab', { name: 'Cabeça' }));
    panel = screen.getByRole('tabpanel', { name: 'Cabeça' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Nuvem' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: strings.profile.nickname }),
      '  Ame\u0301lia   Silva  ',
    );
    await userEvent.click(screen.getByRole('button', { name: strings.profile.save }));
    expect(window.location.pathname).toBe('/');
    expect(screen.getByText('Amélia Silva')).toBeDefined();
    expect(JSON.parse(storage.values.get('penshow.profile')!).avatar.head).toBe('head-cloud');
    expect(stores.session.getState().session).toBe(null);
  });
  it('mantém dados e foco no campo ao rejeitar o apelido vazio', async () => {
    render(<App stores={testStores().stores} />);
    await userEvent.click(await screen.findByRole('button', { name: strings.profile.save }));
    expect(screen.getByRole('alert').textContent).toBe(strings.profile.nicknameError);
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: strings.profile.nickname }),
    );
    expect(window.location.pathname).toBe('/perfil');
  });
  it('continua para o convite local após salvar', async () => {
    window.history.replaceState(null, '', '/perfil?next=%2Fsala%2FABCDEF');
    render(<App stores={testStores().stores} />);
    await userEvent.type(
      await screen.findByRole('textbox', { name: strings.profile.nickname }),
      'Ana',
    );
    await userEvent.click(screen.getByRole('button', { name: strings.profile.save }));
    expect(window.location.pathname).toBe('/sala/ABCDEF');
  });
  it('sorteia sem apagar o apelido nem persistir antes da confirmação', async () => {
    const storage = memoryStorage();
    const { stores } = testStores(storage.access);
    render(<App stores={stores} />);
    await userEvent.type(
      await screen.findByRole('textbox', { name: strings.profile.nickname }),
      'Joana',
    );
    await userEvent.click(screen.getByRole('button', { name: strings.avatar.random }));
    expect(stores.profile.getState().draft.nickname).toBe('Joana');
    expect(storage.values.has('penshow.profile')).toBe(false);
    await waitFor(() =>
      expect(screen.getByRole('img', { name: strings.avatar.preview })).toBeDefined(),
    );
  });
});
