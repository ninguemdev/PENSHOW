import type { MatchStage, RoomView } from '@penshow/shared';
import { strings } from '../../strings/pt-BR';

/** Text for the persistent live region; deadlines never change this message. */
export function resultAnnouncement(stage: MatchStage, view: RoomView): string {
  const name = (id: string) =>
    view.members.find((member) => member.playerId === id)?.profile.nickname ?? strings.match.player;
  if (stage.phase === 'reveal') {
    const answer = stage.reveal.question.options.find(
      (option) => option.optionId === stage.reveal.correctOptionId,
    );
    const reasons = {
      'correct-answer': strings.match.credit,
      'speed-bonus': strings.match.bonus,
      theft: strings.match.theftEffect,
      wager: strings.match.wagerEffect,
      pressure: strings.match.pressureEffect,
    };
    return [
      `${strings.match.correct}: ${answer?.text ?? ''}.`,
      ...stage.effects.map(
        (effect) =>
          `${name(effect.playerId)}: ${effect.kind === 'credit' ? '+' : '−'}${effect.amount} ${reasons[effect.reason]}.`,
      ),
    ].join(' ');
  }
  if (stage.phase === 'final-resolution') {
    const result = stage.resolution;
    if (result.outcome === 'no-answer')
      return 'Ninguém respondeu. Todos os participantes ativos perderam uma vida.';
    const victim = stage.finalists.find(
      (player) =>
        player.playerId === (result.outcome === 'attack' ? result.targetPlayerId : result.playerId),
    )!;
    return [
      result.outcome === 'wrong-answer'
        ? strings.final.wrong(name(result.playerId))
        : strings.final.attacked(name(result.playerId), name(result.targetPlayerId)),
      strings.final.loss(name(victim.playerId), victim.lives + result.damage, victim.lives),
      victim.status === 'eliminated' ? strings.final.elimination(name(victim.playerId)) : '',
      strings.final.closed,
    ].join(' ');
  }
  return '';
}
