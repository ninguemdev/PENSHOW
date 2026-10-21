# T27 — Catálogo de 300 perguntas para testes completos

- **Depende de:** [T11](./T11-primeiro-lote-editorial.md), [T12](./T12-selecao-de-temas-e-perguntas.md)
- **Pacotes:** data, scripts, docs
- **Marco:** M3
- **Branch sugerido:** `task/27-catalogo-de-teste-completo`

O status desta tarefa fica somente no [índice](README.md). A entrega valida o conteúdo e o orçamento experimental de seleção. Não integra a sequência das cinco modalidades nem confirma as decisões de regras pendentes.

## Objetivo

Habilitar partidas completas com conteúdo real e dificuldades suficientes, sem esperar o catálogo de 5.000.

## Leia antes

- [perguntas.md](../perguntas.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Entregáveis

- [x] Expandir o catálogo publicado para pelo menos 300 perguntas revisadas, 50 em cada um de seis temas.
- [x] Por tema, planejar pelo menos 15 fáceis, 20 médias e 15 difíceis, conferindo viabilidade das fases e reserva da final.
- [x] Revisar tradução, resposta única, alternativas plausíveis, referências e duplicatas por sentido.
- [x] Emitir relatório de estoque depois da reserva e simular seleções para grupos de 2 a 12.

## Critérios de aceite

- [x] O orçamento de uma partida completa tem temas elegíveis por fase e a reserva de 50 para a final sem consumir o mesmo enunciado duas vezes.
- [x] Contagem não inclui candidatos ou traduções sem revisão.
- [x] Catálogo e relatório deixam explícitas configurações ainda inviáveis; não mascarar falta de dificuldade.

## Verificação

- [x] Executar compilação, validador e simulações determinísticas de seleção com 2, 4, 8 e 12 jogadores.
- [x] Conferir amostras cruzadas por tema/dificuldade e registrar cada correção factual.

## Implementação e evidências

O [relatório editorial](../revisao-editorial-t27.md) descreve o lote, critérios, 18 amostras cruzadas e limites de dificuldade/diversidade. [t27-editorial.json](../../data/publication-reports/t27-editorial.json) registra 228 novas decisões individuais com antes/depois, referência, data e justificativa. As 72 aprovações da T11, os 1.531 candidatos e o manifesto de fontes foram preservados. Os seis arquivos revisados e o catálogo privado têm 50 itens por tema, com 15 fáceis, 20 médias e 15 difíceis. Nenhuma tradução em inglês entra na contagem.

`pnpm questions:publish`, `pnpm questions:validate` e `pnpm questions:check` passaram com 300 aprovadas e 1.531 candidatas excluídas da publicação. Foram corrigidos gabaritos e critérios, incluindo Rapto das Sabinas, Pantanal, Cordilheira do Alasca, impeachment de Andrew Johnson, conclusão por Elcano, álbum de estreia do BTS, luminosidade estelar e títulos esportivos. Três propostas que repetiam fatos da T11 foram reformuladas na conferência cruzada.

`pnpm questions:simulate` gerou [t27-stock.json](../../data/publication-reports/t27-stock.json), e `pnpm questions:simulate --check` reproduziu seus bytes. São **66 percursos com o seletor real**, tamanhos de grupo de 2 a 12, duas sementes e três políticas de escolha. Todos percorrem cinco fases, preservam/consomem as 50 reservadas e continuam a final até a interrupção explícita por exaustão, sem repetição de ID ou enunciado. O relatório registra estoque por tema/dificuldade após reserva e consumo, ofertas por fase e hash do histórico.

A admissão de **693 configurações** cobre todos os subconjuntos não vazios dos seis temas para 2–12 pessoas: 462 viáveis com três a seis temas, 231 bloqueadas com um ou dois. Dois temas somam apenas 30 fáceis, abaixo das 34 exigidas. Testes adicionais recusam ausência de difíceis e quatro ciclos de dinamite para doze pessoas, sem relaxar dificuldades. A CI verifica o relatório determinístico; o teste editorial confere decisões, procedência, hashes e preservação da T11. Os sete testes de estoque usam o catálogo publicado, incluindo os grupos de 2, 4, 8 e 12.

Em 20/10/2026, `pnpm test` passou com **748 testes**: 403 do servidor, 131 da web, 176 compartilhados, 33 de conteúdo e cinco de artes. `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` e `git diff --check` passaram. A checagem de tipos do servidor também inclui os scripts TypeScript de conteúdo.

Na revisão para integração de 21/10/2026, foram corrigidos acentos corrompidos em 12 itens novos e nas respectivas notas editoriais. O catálogo foi republicado, a simulação foi regenerada e sua reprodução passou. Um teste de integridade textual foi acrescentado; `pnpm test` passou com **749 testes**. O cenário de duas partidas excedeu o prazo na primeira execução sob carga paralela, passou isoladamente e passou novamente na suíte completa, sem alterar seu prazo ou suas asserções.

O smoke clássico com o catálogo novo passou em **desktop e celular emulado: dois testes em 2,6 minutos** (`pnpm --filter @penshow/e2e exec playwright test classic-smoke.spec.ts --output test-results/t27`). O percurso usa duas identidades, convite, recarga, seis perguntas reais com mistura 3 fáceis/3 médias, resposta definitiva, placares de 500/200, classificação e retorno ao lobby. A auditoria das mensagens públicas passou. Relatório/capturas ficam em `e2e/playwright-report/t27/` e `e2e/test-results/t27/`, com `PLAYWRIGHT_HTML_OUTPUT_DIR=playwright-report/t27` definido na execução.

## Cuidados de implementação

Esta frente pode avançar assim que T11/T12 estiverem prontas, sem esperar T26. Os IDs das tarefas não obrigam aguardar a numeração inteira.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
