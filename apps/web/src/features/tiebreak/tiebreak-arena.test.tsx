import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testStores } from '../../test/fixtures';
import { combatStage, finalView } from '../../test/final-fixtures';
import { TiebreakArena } from './tiebreak-arena';

beforeEach(() => {
  vi.useFakeTimers({ now: 1000 });
  // jsdom does not render a canvas; input and DOM focus remain real.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => vi.restoreAllMocks());

function setup() {
  const { stores } = testStores();
  const input = vi.fn().mockResolvedValue(true);
  stores.match.setState({ tiebreakInput: input });
  const view = finalView(combatStage(), 2);
  if (view.state.status !== 'match') throw Error('Partida esperada.');
  const actions = stores.match.getState();
  const f = render(
    <>
      <a href="#outside">Fora da arena</a>
      <TiebreakArena
        view={view}
        match={view.state.match}
        stores={stores}
        now={1000}
        controls={{
          ...actions,
          online: true,
          blocked: false,
          waitingView: false,
          offset: 0,
          error: null,
          attempt: null,
          wagerAttempt: null,
          targetAttempt: null,
        }}
      />
      <dialog tabIndex={-1} aria-label="Confirmação">
        <p tabIndex={-1}>Revisar a escolha</p>
      </dialog>
    </>,
  );
  const arena = f.container.querySelector('canvas')!;
  const tick = async () => {
    await act(() => vi.advanceTimersByTimeAsync(50));
    return input.mock.calls.at(-1)?.[0];
  };
  return { ...f, arena, input, tick };
}

describe('foco e teclado do combate', () => {
  it('controla somente a arena e solta movimento/disparo ao focar um link', async () => {
    const f = setup();
    f.arena.focus();
    fireEvent.keyDown(f.arena, { key: 'd' });
    fireEvent.keyDown(f.arena, { key: ' ' });
    expect(await f.tick()).toMatchObject({ moveX: 1, shooting: true });

    const link = f.getByRole('link');
    link.focus();
    expect(fireEvent.keyDown(link, { key: 'ArrowDown' })).toBe(true);
    expect(await f.tick()).toMatchObject({ moveX: 0, moveY: 0, shooting: false });
    f.arena.focus();
    expect(await f.tick()).toMatchObject({ moveX: 0, moveY: 0, shooting: false });
  });

  it('não movimenta nem dispara com um diálogo aberto, inclusive com foco no texto', async () => {
    const f = setup();
    f.arena.focus();
    fireEvent.keyDown(f.arena, { key: 'd' });
    expect(await f.tick()).toMatchObject({ moveX: 1 });
    const dialog = f.container.querySelector('dialog')!;
    dialog.showModal();
    const text = dialog.querySelector('p')!;
    text.focus();
    expect(fireEvent.keyDown(text, { key: 'd' })).toBe(true);
    expect(fireEvent.keyDown(text, { key: ' ' })).toBe(true);
    expect(await f.tick()).toMatchObject({ moveX: 0, shooting: false });
    dialog.close();
    f.arena.focus();
    expect(await f.tick()).toMatchObject({ moveX: 0, shooting: false });
  });

  it('preserva atalhos do navegador e composição sem gerar movimento', async () => {
    const f = setup();
    f.arena.focus();
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'isComposing'])
      expect(fireEvent.keyDown(f.arena, { key: 'd', [modifier]: true })).toBe(true);
    expect(await f.tick()).toMatchObject({ moveX: 0, shooting: false });
    fireEvent.keyDown(f.arena, { key: 'd' });
    expect(await f.tick()).toMatchObject({ moveX: 1 });
    fireEvent.keyUp(f.arena, { key: 'd', ctrlKey: true });
    expect(await f.tick()).toMatchObject({ moveX: 0 });
  });
});
