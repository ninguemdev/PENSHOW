export const CONFIRMED_FINAL_RULES = Object.freeze({
  initialLivesByRank: Object.freeze([5, 4, 3, 2] as const),
  answerPolicy: 'first-valid-only',
  wrongAnswerDamage: 1,
  attackDamage: 1,
  targetPolicy: 'any-active-opponent',
} as const);

export const CONFIRMED_DECISIONS = Object.freeze({
  D01: '20–30 minutos para 4–8 participantes',
  D02: 'Perda coletiva de uma vida sem resposta na final',
  D03: 'Alvo automático sorteado entre todos os ativos, inclusive quem acertou',
  D04: 'Dinamite por turnos, dois por participante',
  D05: 'Primeiro acerto rouba até 100; todos os acertos ganham 100',
  D06: 'Vidas iguais e posições consecutivas por grupo empatado',
  D09: 'Tiro 2D top-down: três vidas; pergunta em zero; erro elimina e acerto concede uma vida',
} as const);

// Product decisions are answered; implementation status belongs to the task backlog.
export const PENDING_DECISIONS = Object.freeze({});
export type PendingDecisionId = keyof typeof PENDING_DECISIONS;
