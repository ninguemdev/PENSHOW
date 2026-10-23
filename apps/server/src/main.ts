import { buildApp } from './app.js';
import { loadConfig } from './platform/config.js';
import { QuestionCatalogLoadError } from './platform/local-question.repository.js';
import { WebBuildLoadError } from './platform/web.js';

try {
  const config = loadConfig(process.env);
  const app = buildApp({ config });
  const shutdown = () => {
    app.log.info('Encerrando o servidor.');
    void app.close().then(
      () => app.log.info('Servidor encerrado.'),
      () => {
        app.log.error('Falha ao encerrar o servidor.');
        process.exitCode = 1;
      },
    );
  };
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, shutdown);
  try {
    const address = await app.listen({ port: config.port, host: config.host });
    app.log.info({ address }, 'PENSHOW disponível.');
  } catch (error) {
    app.log.error(
      error instanceof QuestionCatalogLoadError || error instanceof WebBuildLoadError
        ? error.message
        : 'Não foi possível iniciar o servidor. Confira HOST, PORT e a disponibilidade da porta.',
    );
    await app.close();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Não foi possível configurar o servidor.');
  process.exitCode = 1;
}
