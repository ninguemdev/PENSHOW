export const CONFIRMED_FINAL_RULES = Object.freeze({
  initialLivesByRank: Object.freeze([5, 4, 3, 2] as const),
  answerPolicy: 'first-valid-only',
  wrongAnswerDamage: 1,
  attackDamage: 1,
  targetPolicy: 'any-active-opponent',
} as const);

export const PENDING_DECISIONS = Object.freeze({
  D01: Object.freeze({ status: 'in-consultation', subject: 'Duração e tempos da partida' }),
  D02: Object.freeze({ status: 'in-consultation', subject: 'Pergunta da final sem resposta' }),
  D03: Object.freeze({ status: 'in-consultation', subject: 'Acerto na final sem escolha de alvo' }),
  D04: Object.freeze({ status: 'in-consultation', subject: 'Modalidade da quinta fase' }),
  D05: Object.freeze({ status: 'in-consultation', subject: 'Direito ao roubo' }),
  D06: Object.freeze({ status: 'in-consultation', subject: 'Desempate antes da final' }),
} as const);

export type PendingDecisionId = keyof typeof PENDING_DECISIONS;
