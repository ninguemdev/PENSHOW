import { z } from 'zod';

export const healthResponseSchema = z.strictObject({
  service: z.literal('penshow'),
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
