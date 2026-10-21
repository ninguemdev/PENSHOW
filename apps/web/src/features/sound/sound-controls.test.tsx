import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SoundControls } from './sound-controls';
import { createSoundStore } from '../../stores/sound-store';
import { memoryStorage } from '../../test/fixtures';

describe('controles de som', () => {
  it('ativa por teclado, ajusta volume, testa e silencia com nomes acessíveis', async () => {
    const engine = {
      unlock: vi.fn().mockResolvedValue(true),
      configure: vi.fn(),
      play: vi.fn().mockReturnValue(true),
      stop: vi.fn(),
      dispose: vi.fn(),
    };
    const store = createSoundStore(memoryStorage().access, engine);
    store.getState().hydrate();
    render(<SoundControls store={store} />);
    const activate = screen.getByRole('button', { name: 'Ativar som' });
    activate.focus();
    expect(engine.unlock).not.toHaveBeenCalled();
    await userEvent.keyboard('[Enter]');
    await screen.findByRole('button', { name: 'Silenciar som' });
    fireEvent.change(screen.getByRole('slider', { name: /Volume do som/ }), {
      target: { value: '65' },
    });
    expect(store.getState().volume).toBe(0.65);
    await userEvent.click(screen.getByRole('button', { name: 'Testar som' }));
    expect(engine.play).toHaveBeenCalledWith('start');
    await userEvent.click(screen.getByRole('button', { name: 'Silenciar som' }));
    expect(screen.getByRole('button', { name: 'Testar som' }).hasAttribute('disabled')).toBe(true);
    expect(store.getState().muted).toBe(true);
  });
  it('explica áudio indisponível sem bloquear navegação ou exigir ativação', async () => {
    const engine = {
      unlock: vi.fn().mockResolvedValue(false),
      configure: vi.fn(),
      play: vi.fn().mockReturnValue(false),
      stop: vi.fn(),
      dispose: vi.fn(),
    };
    const store = createSoundStore(memoryStorage().access, engine);
    render(<SoundControls store={store} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ativar som' }));
    expect((await screen.findByRole('status')).textContent).toContain(
      'Você pode continuar jogando',
    );
    expect(screen.getByRole('button', { name: 'Ativar som' }).hasAttribute('disabled')).toBe(false);
  });
});
