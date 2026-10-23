import { describe, expect, it, vi } from 'vitest';
import { createNarratorStore, NARRATOR_STORAGE_KEY } from './narrator-store';
import { memoryStorage } from '../test/fixtures';
import { matchView, phases } from '../test/match-fixtures';
import { finalPhases, finalView } from '../test/final-fixtures';
import type { NarratorEngine } from '../features/sound/narrator-engine';

function fixture() {
  const storage = memoryStorage();
  const engine: NarratorEngine = {
    unlock: vi.fn().mockResolvedValue(true),
    configure: vi.fn(),
    play: vi.fn().mockResolvedValue(true),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
  const loader = {
    question: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
    preview: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
  };
  const store = createNarratorStore(storage.access, engine, loader);
  return { store, engine, loader, storage };
}
const reading = () =>
  matchView({
    ...phases().reading,
    opensAt: 10000,
    narration: { voice: 'robot-pt-br-v1', durationMs: 7000 },
  });
describe('narrador robótico', () => {
  it('começa desligado e restaura a preferência sem violar a ativação por gesto', () => {
    const f = fixture();
    f.store.getState().hydrate();
    expect(f.store.getState()).toMatchObject({ enabled: false, status: 'locked' });
    f.storage.values.set(
      NARRATOR_STORAGE_KEY,
      JSON.stringify({ version: 1, enabled: true, volume: 0.3 }),
    );
    const restored = createNarratorStore(f.storage.access, f.engine, f.loader);
    restored.getState().hydrate();
    restored.getState().observe(reading(), 1, true, () => 5000);
    expect(f.engine.unlock).not.toHaveBeenCalled();
    expect(f.loader.question).not.toHaveBeenCalled();
    expect(restored.getState()).toMatchObject({ enabled: true, volume: 0.3, status: 'locked' });
  });
  it('narra uma vez por pergunta e passa a janela do servidor para retomada sem reiniciar o áudio', async () => {
    const f = fixture();
    await f.store.getState().activate();
    const now = () => 5000;
    f.store.getState().observe(reading(), 1, true, now);
    f.store.getState().observe(reading(), 1, true, now);
    await vi.waitFor(() => expect(f.engine.play).toHaveBeenCalledTimes(1));
    expect(f.engine.play).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      { startsAt: 2700, endsAt: 9700, now },
      expect.any(Function),
    );
    expect(f.loader.question).toHaveBeenCalledTimes(1);
    f.store.getState().observe(matchView(phases().open), 1, true, now);
    expect(f.store.getState().status).toBe('ready');
    expect(f.engine.stop).toHaveBeenCalled();
  });
  it('cancela download ao desconectar ou ocultar a aba e ignora conclusão atrasada', async () => {
    const f = fixture();
    let complete: (value: ArrayBuffer) => void = () => {
      throw new Error('Download não iniciado.');
    };
    const loaded = new Promise<ArrayBuffer>((resolve) => {
      complete = resolve;
    });
    f.loader.question.mockReturnValue(loaded);
    await f.store.getState().activate();
    f.store.getState().observe(reading(), 1, true, () => 5000);
    const signal = f.loader.question.mock.calls[0]![2] as AbortSignal;
    f.store.getState().observe(reading(), 1, false, () => 5000);
    expect(signal.aborted).toBe(true);
    complete(new ArrayBuffer(4));
    await loaded;
    expect(f.engine.play).not.toHaveBeenCalled();
  });
  it('mantém o jogo utilizável quando áudio não existe e não busca gravação depois da leitura', async () => {
    const f = fixture();
    vi.mocked(f.engine.unlock).mockResolvedValue(false);
    await f.store.getState().activate();
    expect(f.store.getState().status).toBe('unavailable');
    f.store.getState().observe(reading(), 1, true, () => 5000);
    expect(f.loader.question).not.toHaveBeenCalled();
    vi.mocked(f.engine.unlock).mockResolvedValue(true);
    await f.store.getState().activate();
    f.store.getState().observe(reading(), 1, true, () => 10000);
    expect(f.loader.question).not.toHaveBeenCalled();
  });
  it('inclui a final, preserva volume próprio e cancela ao desligar', async () => {
    const f = fixture();
    await f.store.getState().activate();
    f.store.getState().setVolume(0.25);
    const stage = {
      ...finalPhases().reading,
      opensAt: 10000,
      narration: { voice: 'robot-pt-br-v1' as const, durationMs: 7000 },
    };
    f.store.getState().observe(finalView(stage), 1, true, () => 5000);
    await vi.waitFor(() => expect(f.engine.play).toHaveBeenCalled());
    f.store.getState().disable();
    expect(f.store.getState().enabled).toBe(false);
    expect(f.engine.configure).toHaveBeenLastCalledWith(0.25);
  });
});
