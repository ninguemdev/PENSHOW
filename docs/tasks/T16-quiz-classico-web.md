# T16 — Fluxo de perguntas e placar na web

- **Depende de:** [T09](./T09-inicio-convite-e-lobby.md), [T15](./T15-quiz-classico-servidor.md)
- **Pacotes:** web
- **Marco:** M2
- **Branch sugerido:** `task/16-quiz-classico-web`

O status desta tarefa fica somente no [índice](README.md). Implementação e evidências estão registradas abaixo.

## Objetivo

Entregar as telas do primeiro quiz usando somente a visão autoritativa do servidor.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Renderizar instruções, tema, leitura, alternativas, confirmação, revelação e resultado da fase por estado da view.
- [x] Integrar ações de resposta e sincronização de horário nas stores; desabilitar envios indevidos.
- [x] Mostrar progresso, avatares, acertos, explicação curta e variação de pontos.
- [x] Apresentar modo espectador, conexão ausente e erros sem permitir navegar manualmente para outra fase.

## Critérios de aceite

- [x] Escolher uma alternativa envia a resposta sem exigir clique adicional para reservar vez.
- [x] Botões e cronômetro refletem a view após reconexão, sem restaurar tentativa consumida.
- [x] Gabarito não está embutido em componentes, stores ou respostas HTTP antecipadas.
- [x] Celular e teclado conseguem concluir a fase.

## Verificação

- [x] Testar comportamento das telas com eventos e acessibilidade básica, não classes CSS.
- [x] Validar duas sessões atravessando a fase, incluindo erro de envio e revelação com pontos.

## Implementação e evidências

O lobby agora inicia o quiz clássico de teste com dois jogadores conectados e fotografia atual. `features/match/` contém registro de renderizadores, preparação, pergunta/resposta/revelação e placar. A rota da sala renderiza cada etapa da view; acionar comandos ou o cronômetro não avança a fase localmente. Mostra uma fase/seis perguntas, modos de espera/espectador, avatares, pontos, acertos e efeitos/explicação recebidos.

`match-store` monta comandos a partir do estado atual, bloqueia cliques concorrentes e vincula feedback a conexão/sala/partida/fase/pergunta. Timeout não libera uma segunda tentativa nem reenvia automaticamente. A nova conexão precisa de uma fotografia autenticada antes de habilitar ações e conserva `ownAnswer: submitted`. A store de sessão descarta amostra de horário antiga e usa `serverNow` como aproximação enquanto sincroniza. A saída durante partida explica a vaga reservada e pausa controles até recuperar a presença. Detalhes em [quiz-classico-web.md](../quiz-classico-web.md).

Verificação executada em 19/10/2026:

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `git diff --check`: aprovados.
- **576 testes** aprovados: web **96**, servidor **281**, shared **162**, conteúdo **32** e artes **5**, sem skips/todos. A web ganhou **21 testes**: **12** de store/relógio/saída e **9** de interface.
- Testes por eventos/papel/texto verificam início/prontidão/tema, leitura sem alternativas, Enter com envio imediato, confirmação definitiva, falha explícita/incerta, reconexão sem segunda oportunidade, visão nova antes de agir, prazo zero sem revelação local, espectador, modalidade sem renderizador e seis perguntas em duas sessões com erro de envio e efeitos de +100 recebidos.
- Checagem real no Chrome headless, com dois contextos isolados: aplicativo Vite, servidor compilado, Socket.IO, sessões válidas, catálogo publicado de **72** e tempos oficiais. Perfil e associação foram preparados por HTTP/Socket.IO, concentrando esta verificação no quiz. Um viewport desktop de **1280×900** por **Enter** e outro móvel de **360×780** por **toque emulado** atravessaram instruções, tema, seis perguntas distintas, revelação, resultado, conclusão e retorno ao lobby. Placar final **600/0** e acertos exibidos vieram do servidor. Conferida ausência de transbordamento horizontal da página; capturas desktop/móvel da revelação/placar foram inspecionadas. Nenhum endpoint de gabarito ou lógica de pontuação foi acrescentado à web.
- `pnpm questions:check` e `pnpm questions:validate`: **72 aprovadas** íntegras e **1.531 candidatas excluídas** da publicação; nenhum conteúdo editorial foi alterado.

A checagem de navegador foi pontual. A configuração permanente em Playwright, fluxo completo de perfil/criação/convite e integração do smoke à CI continuam na T17. Não houve commit, push ou deploy; D01–D06 e D07 permanecem como registradas, sem entregar outras modalidades ou a partida completa.

## Cuidados de implementação

Preparar renderizadores por modalidade, evitando um componente gigante com cálculo de pontuação. O navegador nunca decide se alguém acertou oficialmente.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
