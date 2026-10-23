import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchGameSounds } from './sound-controller';
import { testStores, memoryStorage, roomView } from '../../test/fixtures';
import { createSoundStore } from '../../stores/sound-store';
import { matchView, phases, pressureView, spectatorId } from '../../test/match-fixtures';
import { createSoundEngine } from './sound-engine';

afterEach(() => vi.restoreAllMocks());
async function harness() {
  const f = testStores();
  const engine = {
    unlock: vi.fn().mockResolvedValue(true),
    configure: vi.fn(),
    play: vi.fn().mockReturnValue(true),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
  f.stores.sound = createSoundStore(memoryStorage().access, engine);
  await f.stores.sound.getState().activate();
  await f.stores.session.getState().activate();
  const push = (view = roomView) =>
    f.callbacks()!.event({ protocolVersion: 1, event: 'room:view', payload: view });
  return { ...f, engine, push };
}

describe('som das fotografias confirmadas', () => {
  it('acompanha a fala do narrador reduzindo só os efeitos e restaura o volume escolhido', async () => {
    const f = await harness(),
      stop = watchGameSounds(f.stores);
    f.stores.narrator.setState({ status: 'speaking' });
    expect(f.engine.configure).toHaveBeenLastCalledWith(0.4 * 0.45, false);
    expect(f.stores.sound.getState().volume).toBe(0.4);
    f.stores.narrator.setState({ status: 'ready' });
    expect(f.engine.configure).toHaveBeenLastCalledWith(0.4, false);
    stop();
  });
  it('observa todas as transições, mantém deduplicação ao remontar e remove assinaturas', async () => {
    const f = await harness();
    let stop = watchGameSounds(f.stores);
    f.push(roomView);
    f.push(matchView(phases().instructions, 2));
    expect(f.engine.play.mock.calls).toEqual([['start']]);
    stop();
    stop = watchGameSounds(f.stores);
    f.push(matchView(phases().instructions, 3));
    f.push(pressureView('open', 4));
    f.push(pressureView('reveal', 5));
    expect(f.engine.play.mock.calls).toEqual([['start'], ['open'], ['explosion']]);
    stop();
    f.push(matchView(phases(2).open, 6));
    f.push(pressureView('reveal', 7));
    expect(f.engine.play).toHaveBeenCalledTimes(3);
  });
  it('descarta explosões recebidas durante queda ou em aba oculta, sem atraso ao voltar', async () => {
    const f = await harness(),
      stop = watchGameSounds(f.stores);
    f.push(pressureView('open', 2));
    f.callbacks()!.status('offline');
    f.push(pressureView('reveal', 3));
    f.callbacks()!.status('online');
    f.push(pressureView('reveal', 4));
    expect(f.engine.play).not.toHaveBeenCalled();
    f.push(matchView(phases(2).open, 5));
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    f.push(matchView(phases(2).reveal, 6));
    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(f.engine.play.mock.calls).toEqual([['open']]);
    expect(f.engine.stop).toHaveBeenCalled();
    stop();
  });
  it('não dá feedback de erro próprio para espectador ou para o turno de outro participante', async () => {
    const f = await harness();
    f.stores.sound
      .getState()
      .observe(
        matchView({ ...phases().open, ownAnswer: { status: 'unavailable' } }, 2, spectatorId),
        1,
        true,
      );
    f.stores.sound.getState().observe(matchView(phases().reveal, 3, spectatorId), 1, true);
    const other = pressureView('reveal', 5);
    if (other.state.status !== 'match' || !other.state.match.pressureTurn) throw new Error();
    other.state.match.pressureTurn = {
      ...other.state.match.pressureTurn,
      outcome: 'passed',
      playerId: spectatorId,
    };
    f.stores.sound.getState().observe(pressureView('open', 4), 1, true);
    f.stores.sound.getState().observe(other, 1, true);
    expect(f.engine.play).not.toHaveBeenCalled();
  });
  it('não cria contexto antes do gesto e tolera dispositivo ausente ou falha na criação', async () => {
    const factory = vi.fn(() => null),
      engine = createSoundEngine(factory);
    engine.configure(1, false);
    expect(engine.play('victory')).toBe(false);
    expect(factory).not.toHaveBeenCalled();
    expect(await engine.unlock()).toBe(false);
    engine.dispose();
    const broken = createSoundEngine(() => {
      throw new Error('audio blocked');
    });
    expect(await broken.unlock()).toBe(false);
    expect(broken.play('damage')).toBe(false);
    broken.dispose();
  });
});
