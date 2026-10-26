import { describe, expect, it } from 'vitest';
import { loadConfig, validateConfig } from './config.js';

describe('configuração do servidor', () => {
  it('lê o ambiente e congela as configurações validadas', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: '8080',
      ALLOWED_ORIGINS: 'https://penshow.example, https://other.example',
      HTTP_BODY_LIMIT: '4096',
      SOCKET_MESSAGE_LIMIT: '8192',
      LOG_LEVEL: 'warn',
    });
    expect(config).toEqual({
      environment: 'production',
      host: '0.0.0.0',
      port: 8080,
      allowedOrigins: ['https://penshow.example', 'https://other.example'],
      httpBodyLimit: 4096,
      socketMessageLimit: 8192,
      guestSessionTtlMs: 86400000,
      logLevel: 'warn',
      webBasePath: '/penshow/',
      narrationEnabled: true,
      gameplayEnabled: false,
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.allowedOrigins)).toBe(true);
  });
  it.each([
    { PORT: '0' },
    { PORT: '65536' },
    { PORT: '1.5' },
    { PORT: 'invalid' },
    { HOST: '' },
    { HOST: 'http://localhost' },
    { NODE_ENV: 'unknown' },
    { LOG_LEVEL: 'everything' },
    { HTTP_BODY_LIMIT: '0' },
    { SOCKET_MESSAGE_LIMIT: '1048577' },
    { GUEST_SESSION_TTL_MS: '999' },
    { GUEST_SESSION_TTL_MS: '604800001' },
    { GUEST_SESSION_TTL_MS: 'invalid' },
    { ALLOWED_ORIGINS: '*' },
    { ALLOWED_ORIGINS: 'null' },
    { ALLOWED_ORIGINS: 'https://example.com/path' },
    { ALLOWED_ORIGINS: 'https://example.com/' },
    { ALLOWED_ORIGINS: 'https://user:password@example.com' },
    { ALLOWED_ORIGINS: 'https://example.com?token=secret' },
    { ALLOWED_ORIGINS: 'https://example.com,https://example.com' },
    { NODE_ENV: 'production' },
    { NARRATION_ENABLED: 'yes' },
    { GAMEPLAY_ENABLED: 'yes' },
    { WEB_ROOT: '' },
    { WEB_ROOT: 'relative/path' },
    { WEB_BASE_PATH: 'penshow' },
    { WEB_BASE_PATH: '/penshow' },
    { WEB_BASE_PATH: '/api/' },
    { WEB_BASE_PATH: '/comicle/' },
    { WEB_BASE_PATH: '/penshow/../' },
  ])('falha com mensagem compreensível: %j', (environment) => {
    expect(() => loadConfig(environment)).toThrow('Configuração inválida:');
  });
  it('não expõe valores inválidos ou credenciais no erro', () => {
    expect(() => loadConfig({ ALLOWED_ORIGINS: 'https://user:secret@example.com' })).toThrow(
      'allowedOrigins',
    );
    try {
      loadConfig({ ALLOWED_ORIGINS: 'https://user:secret@example.com' });
    } catch (error) {
      expect(String(error)).not.toContain('secret');
    }
    expect(() => validateConfig({ ...loadConfig(), port: -1 })).toThrow('port');
  });
});
