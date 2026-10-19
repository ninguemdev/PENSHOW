# T15 — Quiz clássico no servidor

- **Depende de:** [T14](./T14-motor-comum-de-partida.md)
- **Pacotes:** server, shared
- **Marco:** M2
- **Branch sugerido:** `task/15-quiz-classico-servidor`

O status desta tarefa fica somente no [índice](README.md). Implementação e evidências estão registradas abaixo.

## Objetivo

Implementar a primeira modalidade completa com resposta simultânea, revelação e placar.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Implementar seis perguntas, distribuição de dificuldade, leitura, liberação de alternativas e resposta definitiva.
- [x] Creditar +100 por acerto, zero por erro/ausência, com IDs opacos de alternativas gerados no servidor.
- [x] Criar projeções de participante/espectador antes e depois da revelação, incluindo progresso e placar.
- [x] Implementar encerramento do protótipo de uma fase e atualização dos contratos disponíveis.

## Critérios de aceite

- [x] Cada participante responde no máximo uma vez; espectador não responde.
- [x] Gabarito e explicação só chegam após fechar as respostas; anfitrião também não tem acesso antecipado.
- [x] Resposta fora do prazo não pontua; reenviar comando não credita novamente.
- [x] Modo curto fica restrito a desenvolvimento/teste e não aparece como partida completa de seis fases.

## Verificação

- [x] Integrar duas ou mais sessões com respostas corretas, erradas e ausentes.
- [x] Cobrir fronteira de prazo, payload inválido, reconexão após responder e matriz de privacidade.

## Implementação e evidências

`app.ts` instala `MatchService` e `match.handlers.ts` somente quando o ambiente é desenvolvimento ou teste. Os handlers autenticados cobrem início, prontidão, escolha do tema, resposta com ack `recorded` e retorno ao lobby após conclusão/interrupção. O serviço revalida conexão, associação, papel, contexto e prazo dentro da fila. O retorno público fixa `requireFinished: true`, sem aceitar essa opção do cliente. Em produção o motor curto não é instalado.

O fluxo usa a seleção da T12, configuração/pontuação da T13 e máquina transacional da T14: seis perguntas inéditas na partida, três fáceis/três médias, leitura sem alternativas, uma resposta definitiva por participante, +100 por acerto e zero por erro/ausência. O gabarito é avaliado pelo mapa privado de UUIDs, independentemente da posição da alternativa.

As projeções agora incluem `MatchView.progress`, com posição e contagem de fases/perguntas. O protótipo informa uma fase e seis questões e termina em `prototype-complete`; o schema rejeita progresso fora do plano, pergunta aberta com posição zero e conclusão parcial. Schemas e consumidores da versão 1 em desenvolvimento foram atualizados juntos; a interface de jogo pertence à T16. Documentação em [quiz-classico.md](../quiz-classico.md).

Verificação executada em 19/10/2026:

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `git diff --check`: aprovados.
- **555 testes** aprovados: servidor **281**, shared **162**, web **75**, conteúdo **32** e artes **5**, sem skips/todos. São **19 novos casos de rede** e **2 de contrato**, além das suítes existentes de motor/seleção/pontuação.
- `match.realtime.test.ts` executa o aplicativo composto em portas efêmeras, com sessões HTTP e clientes Socket.IO reais. WebSocket e polling percorrem seis perguntas do catálogo publicado com dois jogadores e um espectador, cobrindo acerto/erro/ausência, seis IDs distintos, mistura 3/3, posição variável do gabarito, placar **300/200**, progresso e privacidade em todas as etapas. Retorno ao lobby e novo início geram novo `matchId` e rejeitam contexto antigo.
- Outros casos verificam concorrência/reenvio sem crédito duplicado, espectador e outra sala, campos privados injetados, opção/contexto inválidos, leitura sem resposta, um milissegundo antes/prazo exato, reconexão com resposta própria preservada, aba substituída durante espera na fila, insuficiência de conteúdo, erro interno sanitizado, bloqueio em produção e encerramento sem timers/transportes pendentes.
- `pnpm questions:check` e `pnpm questions:validate`: **72 aprovadas** íntegras e **1.531 candidatas excluídas** da publicação; nenhum conteúdo editorial foi alterado nesta tarefa.
- Smoke dos módulos compilados: aplicativo HTTP/Socket.IO com IDs/sorteio criptográficos, três sessões autenticadas em WebSocket e relógio/agendador controlados. Catálogo real de **72**, seis perguntas distintas, mistura **3 fáceis/3 médias**, placar **600/0**, **92 visões públicas validadas**, retorno ao lobby e **zero tarefas pendentes** após fechamento. Nenhum evento continha campos editoriais/recibos/checkpoint ou gabarito antes da revelação. A composição compilada de produção também foi conferida sem `app.matches`.

Não houve commit, push ou deploy. D01–D06 continuam em consulta; a tarefa não entrega interface de perguntas, outras modalidades, final ou partida completa publicada.

## Cuidados de implementação

Usar as funções de T13 e a seleção de T12. A implementação não deve inferir acerto pela posição de uma opção na fonte.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
