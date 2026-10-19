# T03 — Servidor e infraestrutura de tempo real

- **Depende de:** [T02](./T02-contratos-e-documentacao.md)
- **Pacotes:** server
- **Marco:** M1
- **Branch sugerido:** `task/03-servidor-base`

O status desta tarefa fica somente no [índice](README.md). As entregas verificadas estão marcadas abaixo, com evidências ao final.

## Objetivo

Preparar Fastify, Socket.IO e dependências injetáveis para receber comandos de jogo com previsibilidade.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [analise-comicle.md](../analise-comicle.md)

## Entregáveis

- [x] Compor `buildApp(deps)` e inicialização separada em `main.ts`; validar configuração e expor healthcheck.
- [x] Criar portas pequenas para relógio, agendador, IDs e sorteio, com implementações de produção e suportes determinísticos de teste.
- [x] Configurar transporte, origem permitida, limites básicos de payload, erros públicos e logs sem tokens ou respostas.
- [x] Definir registro de handlers finos: validar entrada, identificar ator e delegar ao serviço; preparar encerramento com limpeza de recursos.

## Critérios de aceite

- [x] Testes podem iniciar e fechar o servidor sem abrir portas fixas nem esperar timers reais.
- [x] Domínio não usa relógio ou aleatoriedade globais; falha de comando não expõe stack trace ao cliente.
- [x] Timers e conexões são limpos ao encerrar a aplicação; configuração inválida falha com mensagem compreensível.

## Verificação

- [x] Testar healthcheck, erro inesperado sanitizado, configuração inválida e encerramento.
- [x] Verificar agendamento, cancelamento e execução com relógio controlado.

## Cuidados de implementação

A composição conhece as implementações; os módulos de regra dependem das portas. Rate limits específicos serão ampliados na T28.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 16/10/2026

- Branch `task/03-servidor-base`, preservando as entregas anteriores presentes no workspace.
- `buildApp(deps)` compõe configuração, runtime, Fastify, Socket.IO e registro de comandos. `main.ts` lê ambiente, inicia escuta e trata encerramento por sinal, sem efeitos de processo ao importar a composição nos testes.
- Portas sem dependências de Node/rede em `apps/server/src/ports.ts`; implementações de produção em `platform/runtime.ts`/`scheduler.ts` e suporte determinístico em `test-support/runtime.ts`, excluído do build. Relógio global, timers e aleatoriedade de produção ficaram na infraestrutura; nenhum módulo de regra foi criado usando globais.
- Configuração validada e congelada, com mensagens compreensíveis sem valores secretos. `.env.example` documenta host, porta, origens, limites e nível de log. Produção exige origens explícitas; o arquivo `.env` não é carregado automaticamente.
- Socket.IO 4.8.4 e `@fastify/cors` 11.3.1 instalados com lockfile próprio. Cliente Socket.IO somente como dependência de teste. Caminho `/penshow/socket.io`, origem exata, limite padrão de 64 KiB e bundle de cliente desabilitado no servidor.
- Transporte real testado em polling e WebSocket, em portas efêmeras. `time:sync` usa o relógio injetado; nomes desconhecidos, envelopes divergentes e argumentos adicionais são rejeitados. Comandos de negócio sem sessão recebem `UNAUTHENTICATED`; identificador e handlers injetados permitem verificar a delegação sem inventar sessões ou serviços de salas.
- Testes cobrem HTTP 400/403/404/413/500, saída inválida de handler e exceções inesperadas. O código público `NOT_FOUND` foi adicionado ao contrato para HTTP 404. Captura de logs HTTP/socket verificou ausência de tokens, respostas, URL privada, stack e mensagem interna.
- Agendador verificado com relógio manual e timers falsos: ordem estável, prazo exato, cancelamento idempotente, prazos maiores que `setTimeout`, falha sem interromper tarefas posteriores e espera por tarefa em andamento.
- Encerramento testado antes de `listen`, repetidamente e com sockets/timers/comando ativos. Novas conexões são bloqueadas durante o fechamento; conexões e timers pendentes são limpos e o comando já iniciado é aguardado.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm install --frozen-lockfile` e `git diff --check` passaram. **191 testes passaram**: 54 de servidor, 124 de shared, oito de conteúdo e cinco da web.
- O executável compilado `apps/server/dist/main.js` foi iniciado em processo próprio: `/health` respondeu HTTP 200 e `time:sync` recebeu confirmação válida em WebSocket. Com `PORT=-1`, encerrou com código 1 e mensagem de configuração. A limpeza graciosa foi verificada pelos testes de `app.close()`; o teste do executável não foi usado como evidência de sinais POSIX no Windows.

Configuração, portas, transporte e ciclo de vida estão descritos em [servidor.md](../servidor.md), com atualizações no [protocolo](../protocolo-realtime.md) e na [arquitetura](../arquitetura.md). Sessões pertencem à T04; serviços de sala/projeção e regras de partida continuam nas tarefas correspondentes. D01–D06 permanecem em consulta.
