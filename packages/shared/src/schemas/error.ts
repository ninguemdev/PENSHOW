import { z } from 'zod';

export const DOMAIN_ERROR_MESSAGES = Object.freeze({
  INVALID_PAYLOAD: 'Os dados enviados são inválidos.',
  UNKNOWN_EVENT: 'Esta ação não é reconhecida.',
  UNAUTHENTICATED: 'Sua sessão expirou. Entre novamente.',
  FORBIDDEN: 'Você não pode realizar esta ação.',
  NOT_FOUND: 'O recurso solicitado não foi encontrado.',
  ROOM_NOT_FOUND: 'A sala não foi encontrada.',
  ROOM_FULL: 'A sala está cheia.',
  NOT_ENOUGH_PLAYERS: 'São necessários pelo menos 2 jogadores conectados.',
  NOT_A_MEMBER: 'Você não participa desta sala.',
  INVALID_PHASE: 'Esta ação não está disponível neste momento.',
  STALE_CONTEXT: 'A partida mudou. Aguarde a atualização da sala.',
  DEADLINE_EXPIRED: 'O prazo desta ação terminou.',
  ALREADY_ANSWERED: 'Sua resposta já foi recebida.',
  QUESTION_CLOSED: 'Esta pergunta já foi encerrada.',
  INVALID_TARGET: 'Escolha um adversário disponível.',
  INSUFFICIENT_BALANCE: 'Você não tem pontos suficientes para esta aposta.',
  INVALID_SETTINGS: 'A configuração da sala é incompatível.',
  INSUFFICIENT_QUESTIONS: 'Não há perguntas revisadas suficientes para esta partida.',
  ACTION_CONFLICT: 'Esta ação já foi usada com outros dados.',
  RATE_LIMITED: 'Muitas ações em pouco tempo. Aguarde e tente novamente.',
  SERVER_BUSY: 'O servidor está cheio. Aguarde e tente novamente.',
  INTERNAL_ERROR: 'Não foi possível concluir a ação. Tente novamente.',
} as const);

export const domainErrorCodeSchema = z.enum([
  'INVALID_PAYLOAD',
  'UNKNOWN_EVENT',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'NOT_ENOUGH_PLAYERS',
  'NOT_A_MEMBER',
  'INVALID_PHASE',
  'STALE_CONTEXT',
  'DEADLINE_EXPIRED',
  'ALREADY_ANSWERED',
  'QUESTION_CLOSED',
  'INVALID_TARGET',
  'INSUFFICIENT_BALANCE',
  'INVALID_SETTINGS',
  'INSUFFICIENT_QUESTIONS',
  'ACTION_CONFLICT',
  'RATE_LIMITED',
  'SERVER_BUSY',
  'INTERNAL_ERROR',
]);

export const domainErrorSchema = z
  .strictObject({ code: domainErrorCodeSchema, message: z.string() })
  .refine(
    (error) => error.message === DOMAIN_ERROR_MESSAGES[error.code],
    'A mensagem precisa corresponder ao código público.',
  );

export type DomainErrorCode = keyof typeof DOMAIN_ERROR_MESSAGES;
export type DomainError = z.infer<typeof domainErrorSchema>;

export function createDomainError(code: DomainErrorCode): DomainError {
  return { code, message: DOMAIN_ERROR_MESSAGES[code] };
}
