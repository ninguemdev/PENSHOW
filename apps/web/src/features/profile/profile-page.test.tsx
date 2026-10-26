import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    const eyes = await screen.findByRole('tab', { name: 'Olhos' });
    eyes.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Boca' }));
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Chapéu' }));
    const panel = screen.getByRole('tabpanel', { name: 'Chapéu' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Coroa' }));
    expect(stores.profile.getState().draft.avatar.hat).toBe('hat-crown');
    const none = within(panel).getByRole('button', { name: strings.avatar.none });
    none.focus();
    await userEvent.keyboard(' ');
    expect(stores.profile.getState().draft.avatar.hat).toBe(null);
    expect(screen.queryByRole('tab', { name: 'Cabeça' })).toBe(null);
    expect(
      (screen.getByRole('slider', { name: 'Tamanho' }) as HTMLInputElement).matches(':disabled'),
    ).toBe(true);
    await userEvent.click(screen.getByRole('tab', { name: 'Olhos' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Posição horizontal' }), {
      target: { value: '12' },
    });
    fireEvent.change(screen.getByRole('slider', { name: 'Tamanho' }), { target: { value: '140' } });
    await userEvent.type(
      screen.getByRole('textbox', { name: strings.profile.nickname }),
      '  Ame\u0301lia   Silva  ',
    );
    await userEvent.click(screen.getByRole('button', { name: strings.profile.save }));
    expect(window.location.pathname).toBe('/');
    expect(screen.getByText('Amélia Silva')).toBeDefined();
    const saved = JSON.parse(storage.values.get('penshow.profile')!);
    expect(saved.avatar.head).toBe('head-round');
    expect(saved.avatar.layout.parts.eyes).toEqual({ x: 0.12, y: 0, scale: 1.4 });
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
