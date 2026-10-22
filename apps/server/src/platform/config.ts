import { isIP } from 'node:net';
import { isAbsolute } from 'node:path';
import { z } from 'zod';

const originSchema = z.string().refine((value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  } catch {
    return false;
  }
}, 'Informe uma origem HTTP(S) sem caminho, credenciais, consulta ou barra final.');

export const serverConfigSchema = z.strictObject({
  environment: z.enum(['development', 'test', 'production']),
  host: z
    .string()
    .min(1)
    .refine(
      (value) =>
        isIP(value) !== 0 || /^(?=.{1,253}$)[a-zA-Z0-9]+(?:[.-][a-zA-Z0-9]+)*$/u.test(value),
      'Informe um IP ou nome de host válido.',
    ),
  port: z.number().int().min(1).max(65535),
  allowedOrigins: z
    .array(originSchema)
    .min(1)
    .max(16)
    .refine((values) => new Set(values).size === values.length, 'Não repita origens.'),
  httpBodyLimit: z.number().int().min(1024).max(1048576),
  socketMessageLimit: z.number().int().min(1024).max(1048576),
  guestSessionTtlMs: z.number().int().min(1000).max(604800000),
  logLevel: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']),
  webRoot: z.string().min(1).refine(isAbsolute, 'Informe um caminho absoluto.').optional(),
  webBasePath: z
    .string()
    .regex(/^\/(?:[a-zA-Z0-9_-]+\/)*$/u)
    .refine((value) => !/^\/(?:api|comicle)(?:\/|$)|^\/penshow\/socket[.]io/u.test(value))
    .default('/penshow/'),
});

export type ServerConfig = Readonly<
  Omit<z.infer<typeof serverConfigSchema>, 'allowedOrigins'> & { allowedOrigins: readonly string[] }
>;
export const SOCKET_PATH = '/penshow/socket.io';

export function validateConfig(value: unknown): ServerConfig {
  const result = serverConfigSchema.safeParse(value);
  if (!result.success) {
    throw new Error(
      `Configuração inválida: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  return Object.freeze({
    ...result.data,
    allowedOrigins: Object.freeze([...result.data.allowedOrigins]),
  });
}

export function loadConfig(
  environment: Readonly<Record<string, string | undefined>> = {},
): ServerConfig {
  const mode = environment.NODE_ENV ?? 'development';
  if (mode === 'production' && !environment.ALLOWED_ORIGINS) {
    throw new Error('Configuração inválida: ALLOWED_ORIGINS é obrigatório em produção.');
  }
  return validateConfig({
    environment: mode,
    host: environment.HOST ?? '127.0.0.1',
    port: Number(environment.PORT ?? 3000),
    allowedOrigins: (
      environment.ALLOWED_ORIGINS ??
      'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173'
    )
      .split(',')
      .map((origin) => origin.trim()),
    httpBodyLimit: Number(environment.HTTP_BODY_LIMIT ?? 65536),
    socketMessageLimit: Number(environment.SOCKET_MESSAGE_LIMIT ?? 65536),
    guestSessionTtlMs: Number(environment.GUEST_SESSION_TTL_MS ?? 86400000),
    logLevel: environment.LOG_LEVEL ?? (mode === 'test' ? 'silent' : 'info'),
    ...(environment.WEB_ROOT !== undefined ? { webRoot: environment.WEB_ROOT } : {}),
    webBasePath: environment.WEB_BASE_PATH ?? '/penshow/',
  });
}
