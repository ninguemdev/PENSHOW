import { describe, expect, it } from 'vitest';
import { createSoundTracker } from './game-sounds';
import { matchView, phases, hostId, guestId } from '../../test/match-fixtures';
import { roomView } from '../../test/fixtures';
import { finalView, finalPhases } from '../../test/final-fixtures';

describe('avisos discretos das transições', () => {
  it('separa fase, escolha, pergunta, abertura e confirmação sem tocar por respostas de outros', () => {
    const tracker = createSoundTracker(),
      p = phases();
    const observe = (view: ReturnType<typeof matchView>) => tracker.observe(view, 1, true);
    expect(observe(roomView)).toBeNull();
    expect(observe(matchView(p.instructions, 2))).toBe('start');
    expect(observe(matchView(p.category, 3))).toBe('choice');
    expect(observe(matchView(p.reading, 4))).toBe('question');
    expect(observe(matchView(p.reading, 5))).toBeNull();
    expect(observe(matchView(p.open, 6))).toBe('open');
    expect(observe(matchView({ ...p.open, answeredPlayerIds: [guestId] }, 7))).toBeNull();
    const submitted = {
      ...p.open,
      ownAnswer: { status: 'submitted' as const, optionId: p.open.question.options[0]!.optionId },
      answeredPlayerIds: [hostId, guestId],
    };
    expect(observe(matchView(submitted, 8))).toBe('confirm');
    expect(observe(matchView(submitted, 9))).toBeNull();
    expect(observe(matchView(p.results, 10))).toBe('results');
    expect(observe(matchView(p.results, 11))).toBeNull();
  });
  it('avisa entrada/saída real no lobby sem confundir atualização de presença com entrada', () => {
    const tracker = createSoundTracker();
    tracker.observe(roomView, 1, true);
    const joined = {
      ...roomView,
      stateVersion: 2,
      members: [
        ...roomView.members,
        { ...roomView.members[0]!, playerId: guestId, role: 'player' as const, isHost: false },
      ],
    };
    expect(tracker.observe(joined, 1, true)).toBe('join');
    expect(tracker.observe({ ...joined, stateVersion: 3 }, 1, true)).toBeNull();
    expect(tracker.observe({ ...roomView, stateVersion: 4 }, 1, true)).toBe('leave');
  });
  it('consome pergunta e abertura recebidas sem conexão ou em nova época sem tocar atrasado', () => {
    const tracker = createSoundTracker();
    tracker.observe(matchView(phases().instructions), 1, true);
    expect(tracker.observe(matchView(phases().reading, 3), 2, false)).toBeNull();
    expect(tracker.observe(matchView(phases().reading, 4), 2, true)).toBeNull();
    expect(tracker.observe(matchView(phases().open, 5), 2, true)).toBe('open');
    expect(tracker.observe(matchView(phases().open, 6), 3, true)).toBeNull();
  });
  it('inclui leitura/abertura da final e uma pausa confirmada sem alterar o estado', () => {
    const tracker = createSoundTracker(),
      final = finalPhases();
    tracker.observe(finalView(final.instructions, 1), 1, true);
    expect(tracker.observe(finalView(final.reading, 2), 1, true)).toBe('question');
    expect(tracker.observe(finalView(final.open, 3), 1, true)).toBe('open');
    const paused = {
      phase: 'final-no-answer-pending' as const,
      round: final.open.round,
      finalists: final.open.finalists,
      question: final.open.question,
      decisionId: 'D02' as const,
    };
    expect(tracker.observe(finalView(paused, 4), 1, true)).toBe('notice');
    expect(tracker.observe(finalView(paused, 5), 1, true)).toBeNull();
  });
});
