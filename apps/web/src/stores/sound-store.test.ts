import { describe, expect, it, vi } from 'vitest';
import { createSoundStore, SOUND_STORAGE_KEY } from './sound-store';
import { memoryStorage } from '../test/fixtures';
import {
  matchView,
  phases,
  pressureView,
  theftView,
  hostId,
  guestId,
} from '../test/match-fixtures';
import { finalPhases, finalView, thirdId } from '../test/final-fixtures';
import type { SoundEngine } from '../features/sound/sound-engine';

function harness(storage = memoryStorage()) {
  const engine = {
    unlock: vi.fn<SoundEngine['unlock']>().mockResolvedValue(true),
    configure: vi.fn<SoundEngine['configure']>(),
    play: vi.fn<SoundEngine['play']>().mockReturnValue(true),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
  const store = createSoundStore(storage.access, engine);
  return { store, engine, storage };
}
function podium(version = 5) {
  const source = finalPhases().open;
  return finalView(
    {
      phase: 'podium',
      round: source.round,
      finalists: source.finalists.map((player, index) =>
        player.playerId === hostId
          ? player
          : { ...player, lives: 0, status: 'eliminated', eliminationOrder: 3 - index },
      ),
      standings: [hostId, guestId, thirdId],
    },
    version,
  );
}

describe('preferências e efeitos de som', () => {
  it('diminui efeitos durante a fala sem sobrescrever volume/silêncio e sem reproduzir avisos', async () => {
    const f = harness();
    await f.store.getState().activate();
    f.store.getState().setVolume(0.8);
    f.store.getState().setDucked(true);
    expect(f.engine.configure).toHaveBeenLastCalledWith(0.8 * 0.45, false);
    expect(f.store.getState().volume).toBe(0.8);
    expect(JSON.parse(f.storage.values.get(SOUND_STORAGE_KEY)!)).toEqual({
      version: 1,
      volume: 0.8,
      muted: false,
    });
    f.store.getState().setVolume(0.6);
    expect(f.engine.configure).toHaveBeenLastCalledWith(0.6 * 0.45, false);
    expect(JSON.parse(f.storage.values.get(SOUND_STORAGE_KEY)!)).toEqual({
      version: 1,
      volume: 0.6,
      muted: false,
    });
    f.store.getState().setDucked(false);
    expect(f.engine.configure).toHaveBeenLastCalledWith(0.6, false);
    f.store.getState().mute();
    f.store.getState().setDucked(true);
    expect(f.engine.configure).toHaveBeenLastCalledWith(0.6 * 0.45, true);
    expect(f.engine.play).not.toHaveBeenCalled();
  });
  it('só toca interações depois da ativação e respeita volume zero e silêncio', async () => {
    const f = harness();
    f.store.getState().interact('click');
    expect(f.engine.play).not.toHaveBeenCalled();
    await f.store.getState().activate();
    f.store.getState().interact('click');
    f.store.getState().interact('navigate');
    expect(f.engine.play.mock.calls).toEqual([['click'], ['navigate']]);
    f.store.getState().setVolume(0);
    f.store.getState().interact('click');
    f.store.getState().setVolume(0.4);
    f.store.getState().mute();
    f.store.getState().interact('click');
    expect(f.engine.play).toHaveBeenCalledTimes(2);
  });
  it.each([100, 0])(
    'roubo mantém o acerto após o crédito antecipado de %s pontos',
    async (points) => {
      const f = harness();
      await f.store.getState().activate();
      const target = theftView('target', 3),
        reveal = theftView('reveal', 4);
      if (
        target.state.status !== 'match' ||
        target.state.match.stage.phase !== 'theft-target-selection' ||
        reveal.state.status !== 'match'
      )
        throw new Error();
      const open = matchView({ ...phases().open, round: target.state.match.stage.round }, 2);
      target.state.match.scoreboard.forEach((score) => {
        score.points = points;
      });
      reveal.state.match.scoreboard.forEach((score) => {
        score.points = points;
      });
      f.store.getState().observe(open, 1, true);
      f.store.getState().observe(target, 1, true);
      f.store.getState().observe(reveal, 1, true);
      expect(f.engine.play.mock.calls).toEqual([['choice'], ['correct']]);
    },
  );
  it('começa em silêncio, não cria áudio na hidratação e só persiste a escolha do jogador', async () => {
    const f = harness();
    f.store.getState().hydrate();
    f.store.getState().hydrate();
    expect(f.store.getState()).toMatchObject({ volume: 0.4, muted: true, status: 'locked' });
    expect(f.storage.values.has(SOUND_STORAGE_KEY)).toBe(false);
    expect(f.engine.unlock).not.toHaveBeenCalled();
    const activation = f.store.getState().activate();
    expect(f.engine.unlock).toHaveBeenCalledTimes(1);
    await activation;
    f.store.getState().setVolume(0.75);
    f.store.getState().mute();
    f.store.getState().setVolume(0.5);
    expect(JSON.parse(f.storage.values.get(SOUND_STORAGE_KEY)!)).toEqual({
      version: 1,
      volume: 0.5,
      muted: true,
    });
    expect(f.engine.configure).toHaveBeenLastCalledWith(0.5, true);
  });
  it('restaura volume e silêncio, sem desbloquear áudio automaticamente', () => {
    const storage = memoryStorage();
    storage.values.set(
      SOUND_STORAGE_KEY,
      JSON.stringify({ version: 1, volume: 0.27, muted: false }),
    );
    const f = harness(storage);
    f.store.getState().hydrate();
    expect(f.store.getState()).toMatchObject({ volume: 0.27, muted: false, status: 'locked' });
    expect(f.engine.unlock).not.toHaveBeenCalled();
  });
  it.each([
    '{',
    '{"version":1,"volume":2,"muted":false}',
    '{"version":1,"volume":0.4,"muted":"false"}',
  ])('recupera preferência inválida %s', (raw) => {
    const storage = memoryStorage();
    storage.values.set(SOUND_STORAGE_KEY, raw);
    const f = harness(storage);
    f.store.getState().hydrate();
    expect(f.store.getState()).toMatchObject({ muted: true, volume: 0.4, storageIssue: 'corrupt' });
    expect(storage.values.has(SOUND_STORAGE_KEY)).toBe(false);
  });
  it('mantém a escolha em memória quando acesso ou gravação falham', async () => {
    const engine = harness().engine;
    const store = createSoundStore(() => {
      throw new DOMException('blocked', 'SecurityError');
    }, engine);
    store.getState().hydrate();
    await store.getState().activate();
    store.getState().setVolume(0.7);
    expect(store.getState()).toMatchObject({
      volume: 0.7,
      muted: false,
      storageIssue: 'unavailable',
      status: 'ready',
    });
    expect(engine.configure).toHaveBeenLastCalledWith(0.7, false);
    const storage = memoryStorage();
    const quota = createSoundStore(
      () => ({
        ...storage.access(),
        setItem: () => {
          throw new DOMException('full', 'QuotaExceededError');
        },
      }),
      engine,
    );
    quota.getState().hydrate();
    quota.getState().setVolume(0.9);
    expect(quota.getState()).toMatchObject({ volume: 0.9, storageIssue: 'unavailable' });
  });
  it('ignora valores não finitos e limita o volume sem afetar o silêncio', () => {
    const f = harness();
    f.store.getState().setVolume(NaN);
    f.store.getState().setVolume(Infinity);
    expect(f.store.getState().volume).toBe(0.4);
    f.store.getState().setVolume(2);
    expect(f.store.getState().volume).toBe(1);
    f.store.getState().setVolume(-1);
    expect(f.store.getState()).toMatchObject({ volume: 0, muted: true });
  });
  it('falha de áudio é recuperável e um desbloqueio tardio não desfaz silêncio ou descarte', async () => {
    const f = harness();
    f.engine.unlock.mockRejectedValueOnce(new Error('no device'));
    await f.store.getState().activate();
    expect(f.store.getState().status).toBe('unavailable');
    let resolve!: (ready: boolean) => void;
    f.engine.unlock.mockReturnValueOnce(
      new Promise<boolean>((done) => {
        resolve = done;
      }),
    );
    const pending = f.store.getState().activate();
    f.store.getState().mute();
    resolve(true);
    await pending;
    expect(f.store.getState()).toMatchObject({ muted: true, status: 'locked' });
    const second = f.store.getState().activate();
    f.store.getState().dispose();
    await second;
    expect(f.store.getState().status).toBe('locked');
  });
  it('reenvio, reconexão, primeira fotografia e remontagem não repetem explosão ou vitória', async () => {
    const f = harness();
    await f.store.getState().activate();
    const observe = f.store.getState().observe;
    observe(pressureView('open', 2), 1, true);
    observe(pressureView('reveal', 3), 1, true);
    observe(pressureView('reveal', 4), 1, true);
    observe(pressureView('reveal', 5), 2, false);
    observe(pressureView('reveal', 6), 2, true);
    expect(f.engine.play.mock.calls).toEqual([['explosion']]);
    observe(finalView(finalPhases().wrong, 7), 2, false);
    observe(podium(8), 2, true);
    observe(podium(9), 2, true);
    f.store.getState().dispose();
    await f.store.getState().activate();
    observe(podium(10), 2, true);
    observe(podium(11), 3, false);
    observe(podium(12), 3, true);
    expect(f.engine.play.mock.calls).toEqual([['explosion'], ['victory']]);
    const fresh = harness();
    await fresh.store.getState().activate();
    fresh.store.getState().observe(podium(), 1, true);
    expect(fresh.engine.play).not.toHaveBeenCalled();
  });
  it('consome transições silenciosas e não as toca ao reativar, reconectar ou voltar à aba', async () => {
    const f = harness();
    f.store.getState().observe(pressureView('open', 2), 1, true);
    f.store.getState().observe(pressureView('reveal', 3), 1, true);
    await f.store.getState().activate();
    f.store.getState().observe(pressureView('reveal', 4), 1, true);
    f.store.getState().observe(finalView(finalPhases().open, 5), 1, false);
    f.store.getState().observe(finalView(finalPhases().wrong, 6), 1, false);
    f.store.getState().observe(finalView(finalPhases().wrong, 7), 1, true);
    expect(f.engine.play).not.toHaveBeenCalled();
    expect(f.engine.stop).toHaveBeenCalled();
  });
  it('confirma o registro separadamente e usa somente o resultado confirmado para acerto/erro e dano', async () => {
    const f = harness();
    await f.store.getState().activate();
    f.store.getState().observe(matchView(phases().open, 2), 1, true);
    f.store.getState().observe(
      matchView(
        {
          ...phases().open,
          answeredPlayerIds: [hostId],
          ownAnswer: {
            status: 'submitted',
            optionId: phases().open.question.options[0]!.optionId,
          },
        },
        3,
      ),
      1,
      true,
    );
    expect(f.engine.play.mock.calls).toEqual([['confirm']]);
    f.store.getState().observe(
      matchView(phases().reveal, 4, hostId, 1, [
        { playerId: hostId, points: 100, correctAnswers: 1 },
        { playerId: guestId, points: 0, correctAnswers: 0 },
      ]),
      1,
      true,
    );
    f.store.getState().observe(matchView(phases(2).open, 5), 1, true);
    f.store.getState().observe(matchView(phases(2).reveal, 6), 1, true);
    f.store.getState().observe(finalView(finalPhases().open, 7), 1, true);
    f.store.getState().observe(finalView(finalPhases().target, 8), 1, true);
    f.store.getState().observe(finalView(finalPhases().wrong, 9), 1, true);
    expect(f.engine.play.mock.calls).toEqual([
      ['confirm'],
      ['correct'],
      ['open'],
      ['wrong'],
      ['open'],
      ['correct'],
      ['damage'],
    ]);
  });
});
