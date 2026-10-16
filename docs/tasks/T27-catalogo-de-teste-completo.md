# T27 — Catálogo de 300 perguntas para testes completos

- **Depende de:** [T11](./T11-primeiro-lote-editorial.md), [T12](./T12-selecao-de-temas-e-perguntas.md)
- **Pacotes:** data, scripts, docs
- **Marco:** M3
- **Branch sugerido:** `task/27-catalogo-de-teste-completo`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Habilitar partidas completas com conteúdo real e dificuldades suficientes, sem esperar o catálogo de 5.000.

## Leia antes

- [perguntas.md](../perguntas.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Entregáveis

- [ ] Expandir o catálogo publicado para pelo menos 300 perguntas revisadas, 50 em cada um de seis temas.
- [ ] Por tema, planejar pelo menos 15 fáceis, 20 médias e 15 difíceis, conferindo viabilidade das fases e reserva da final.
- [ ] Revisar tradução, resposta única, alternativas plausíveis, referências e duplicatas por sentido.
- [ ] Emitir relatório de estoque depois da reserva e simular seleções para grupos de 2 a 12.

## Critérios de aceite

- [ ] Uma partida completa tem temas elegíveis por fase e a reserva de 50 para a final sem consumir o mesmo enunciado duas vezes.
- [ ] Contagem não inclui candidatos ou traduções sem revisão.
- [ ] Catálogo e relatório deixam explícitas configurações ainda inviáveis; não mascarar falta de dificuldade.

## Verificação

- [ ] Executar compilação, validador e simulações determinísticas de seleção com 2, 4, 8 e 12 jogadores.
- [ ] Conferir amostras cruzadas por tema/dificuldade e registrar cada correção factual.

## Cuidados de implementação

Esta frente pode avançar assim que T11/T12 estiverem prontas, sem esperar T26. Os IDs das tarefas não obrigam aguardar a numeração inteira.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
