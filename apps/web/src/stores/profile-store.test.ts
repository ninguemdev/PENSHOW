import { describe, expect, it } from 'vitest';
import { defaultAvatar } from '@penshow/shared';
import { memoryStorage, profile } from '../test/fixtures';
import { createProfileStore } from './profile-store';

describe('perfil persistido e rascunho', () => {
  it('começa com nome vazio e sorteio determinístico, sem gravar antes de salvar', () => {
    const storage = memoryStorage();
    const store = createProfileStore(storage.access, { integer: (max) => max - 1 });
    store.getState().hydrate();
    expect(store.getState().draft.nickname).toBe('');
    expect(store.getState().draft.avatar.head).toBe('head-cloud');
    expect(store.getState().profile).toBe(null);
    expect(storage.values.size).toBe(0);
    store.getState().changeNickname('Ana');
    store.getState().hydrate();
    expect(store.getState().draft.nickname).toBe('Ana');
  });
  it('recupera peças válidas de catálogo antigo e regrava a versão saneada', () => {
    const storage = memoryStorage();
    storage.values.set(
      'penshow.profile',
      JSON.stringify({
        nickname: '  Ame\u0301lia  ',
        avatar: { head: 'removed', eyes: 'eyes-happy', mouth: 'mouth-smile', hat: 'hat-crown' },
      }),
    );
    const store = createProfileStore(storage.access);
    store.getState().hydrate();
    expect(store.getState().profile).toEqual({
      nickname: 'Amélia',
      avatar: { ...defaultAvatar(), eyes: 'eyes-happy', hat: 'hat-crown' },
    });
    expect(store.getState().recovered).toBe(true);
    expect(JSON.parse(storage.values.get('penshow.profile')!)).toEqual(store.getState().profile);
  });
  it('salva somente o perfil, preserva escolhas no reload e mantém a sessão separada', () => {
    const storage = memoryStorage();
    storage.values.set('penshow.session', 'untouched');
    const store = createProfileStore(storage.access);
    store.getState().hydrate();
    store.getState().changeNickname('😀'.repeat(20));
    store.getState().selectPart('hat', 'hat-crown');
    expect(store.getState().save()).toBe(true);
    const restored = createProfileStore(storage.access);
    restored.getState().hydrate();
    expect(restored.getState().profile).toEqual(store.getState().profile);
    expect(storage.values.get('penshow.session')).toBe('untouched');
    expect(Object.keys(JSON.parse(storage.values.get('penshow.profile')!))).toEqual([
      'nickname',
      'avatar',
    ]);
  });
  it('não remove categorias obrigatórias nem seleciona peças da categoria errada', () => {
    const store = createProfileStore(memoryStorage().access, { integer: () => 0 });
    store.getState().hydrate();
    store.getState().selectPart('head', null);
    store.getState().selectPart('mouth', 'hat-crown');
    expect(store.getState().draft.avatar).toEqual(defaultAvatar());
    store.getState().selectPart('hat', 'hat-crown');
    store.getState().selectPart('hat', null);
    expect(store.getState().draft.avatar.hat).toBe(null);
  });
  it('não altera o perfil salvo ao rejeitar nome vazio, longo ou invisível', () => {
    const store = createProfileStore(memoryStorage().access);
    store.getState().save(profile);
    for (const nickname of ['', ' '.repeat(4), '😀'.repeat(21), 'Ana\u202e']) {
      store.getState().changeNickname(nickname);
      expect(store.getState().save()).toBe(false);
      expect(store.getState().error).toBe('nickname');
      expect(store.getState().profile).toEqual(profile);
    }
  });
});
