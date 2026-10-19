import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('contrato público de saúde', () => {
  it('aceita a resposta do serviço PENSHOW', () => {
    expect(healthResponseSchema.parse({ service: 'penshow', status: 'ok' })).toEqual({
      service: 'penshow',
      status: 'ok',
    });
  });

  it.each([
    { service: 'outro-jogo', status: 'ok' },
    { service: 'penshow', status: 'offline' },
    { service: 'penshow' },
    { service: 'penshow', status: 'ok', privateToken: 'segredo' },
    null,
  ])('rejeita uma resposta incompatível: %j', (response) => {
    expect(healthResponseSchema.safeParse(response).success).toBe(false);
  });
});
