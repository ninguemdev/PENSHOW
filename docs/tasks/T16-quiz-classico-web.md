# T16 — Fluxo de perguntas e placar na web

- **Depende de:** [T09](./T09-inicio-convite-e-lobby.md), [T15](./T15-quiz-classico-servidor.md)
- **Pacotes:** web
- **Marco:** M2
- **Branch sugerido:** `task/16-quiz-classico-web`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Entregar as telas do primeiro quiz usando somente a visão autoritativa do servidor.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [ ] Renderizar instruções, tema, leitura, alternativas, confirmação, revelação e resultado da fase por estado da view.
- [ ] Integrar ações de resposta e sincronização de horário nas stores; desabilitar envios indevidos.
- [ ] Mostrar progresso, avatares, acertos, explicação curta e variação de pontos.
- [ ] Apresentar modo espectador, conexão ausente e erros sem permitir navegar manualmente para outra fase.

## Critérios de aceite

- [ ] Escolher uma alternativa envia a resposta sem exigir clique adicional para reservar vez.
- [ ] Botões e cronômetro refletem a view após reconexão, sem restaurar tentativa consumida.
- [ ] Gabarito não está embutido em componentes, stores ou respostas HTTP antecipadas.
- [ ] Celular e teclado conseguem concluir a fase.

## Verificação

- [ ] Testar comportamento das telas com eventos e acessibilidade básica, não classes CSS.
- [ ] Validar duas sessões atravessando a fase, incluindo erro de envio e revelação com pontos.

## Cuidados de implementação

Preparar renderizadores por modalidade, evitando um componente gigante com cálculo de pontuação. O navegador nunca decide se alguém acertou oficialmente.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
