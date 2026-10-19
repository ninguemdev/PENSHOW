# T11 — Primeiro lote de perguntas revisadas

- **Depende de:** [T10](./T10-catalogo-e-publicacao-de-perguntas.md)
- **Pacotes:** data, docs
- **Marco:** M2
- **Branch sugerido:** `task/11-primeiro-lote-editorial`

O status desta tarefa fica somente no [índice](README.md). As evidências abaixo descrevem os arquivos publicados e as verificações executadas.

## Objetivo

Disponibilizar conteúdo real suficiente para o primeiro quiz jogável e para experimentar modalidades isoladas.

## Leia antes

- [perguntas.md](../perguntas.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Entregáveis

- [x] Revisar pelo menos 72 perguntas em pt-BR: 12 em cada um dos seis temas iniciais.
- [x] Em cada tema, publicar pelo menos seis fáceis, quatro médias e duas difíceis, verificando resposta única e alternativas.
- [x] Corrigir/rejeitar conteúdo desatualizado e guardar referência factual e data de revisão.
- [x] Atualizar manifesto do catálogo e relatório editorial, sem alterar o status dos demais candidatos.

## Critérios de aceite

- [x] Quiz clássico de seis perguntas consegue oferecer temas válidos com a mistura planejada.
- [x] As 72 perguntas têm revisão factual rastreável e não apresentam duplicatas literais ou de sentido dentro do lote.
- [x] A quantidade é apresentada como lote inicial, não como cobertura de uma partida completa com doze jogadores.

## Verificação

- [x] Executar validador/publicação e conferir totais por tema e dificuldade.
- [x] Revisar a pergunta do país mais populoso, as alternativas do Danúbio e ambiguidades de critério observadas na análise.

## Cuidados de implementação

Não marcar todos os registros como aprovados por passar nos scripts. Esse lote não substitui as 300 perguntas da T27 nem as 5.000 da T33.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 17/10/2026

- Branch `task/11-primeiro-lote-editorial`, preservando as entregas anteriores no workspace. Seis listas em `data/questions/reviewed/` contêm 72 registros aprovados em pt-BR: artes e literatura, geografia, história, cultura pop, ciência e natureza e esportes, cada qual com seis fáceis, quatro médias e duas difíceis.
- Referências factuais consultadas individualmente; enunciado, quatro alternativas e resposta única conferidos antes da aprovação. Treze registros foram confirmados sem alteração nesses campos e 59 receberam correção ou reformulação. A dificuldade é editorial provisória e não foi calibrada com jogadores. O [relatório editorial](../revisao-editorial-t11.md) registra método, correções de maior impacto e limites de diversidade do lote.
- `data/publication-reports/t11-editorial.json` registra as 72 decisões por ID, índice da fonte, dificuldade, referência, data, justificativa e conteúdo antes/depois. A referência da XL para “25” foi conferida pelo conteúdo indexado, com HTTP 403 na abertura direta explicitamente registrado. Não foram copiados artigos ou letras de músicas.
- Corrigidos o gabarito populacional com recorte em 2023, o Danúbio com múltiplos países válidos e o lago Baikal sem critério de tamanho. Também corrigidos gene em vez de DNA, técnico do Brasil em 2002 e quantidade de ouros em Tóquio; explicitados unidade termodinâmica de base, Davi de mármore de Florença, edifício do MASP, áudio original de Woody e versões/anos de filmes.
- IDs e objetos `source` preservados em todas as revisões. Os 28 JSON de candidatos e `data/sources.json` conservaram os bytes, com hashes antes/depois conferidos e guardados no relatório. Permanecem 531 candidatos `needs-review` em pt-BR e 1.000 `needs-translation` em inglês. Nenhuma nova coleta foi feita; aprovação está nas cópias revisadas.
- `pnpm questions:validate`, `pnpm questions:publish` e `pnpm questions:check` passaram: 72 aprovadas, seis temas com estoque 6/4/2, nenhum erro ou duplicata na publicação. O manifesto embutido e a atribuição/licença MIT foram atualizados. A revisão comparou os fatos perguntados por sentido; variantes equivalentes ficaram fora do lote.
- Smoke com JavaScript compilado, executando com diretório corrente fora do workspace: `buildApp` carregou o catálogo real com 72 registros; filtros do repositório retornaram 6/4/2 em cada tema e disponibilidade igual ao manifesto. A amostra de estoque de cada tema reuniu três fáceis e três médias distintas, conforme o aquecimento proposto, sobrando 3/1/2. Todos os seis temas têm conteúdo para essa fase isolada. Isso não implementa nem testa o seletor da T12.
- HTTP do servidor: saúde 200 e criação de sessão 201; caminhos de perguntas, catálogo e arquivo privado retornaram 404, sem IDs editoriais ou gabaritos nas respostas. Vite real em porta efêmera retornou 403 para catálogo, lista revisada e relatório individual por `/@fs`, mantendo a página com HTTP 200. Nos 54 arquivos do bundle web não foram encontrados IDs/enunciados do lote ou hash do catálogo privado. Aplicações e servidores de verificação encerrados; scripts temporários removidos.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` e `pnpm build` passaram. **440 testes**: 32 de conteúdo/publicação, cinco de artes, 159 shared, 169 server e 75 web. Não foram adicionados testes que apenas espelham o conteúdo estático; a conferência factual e de estoque está documentada no relatório. A CI hospedada depende do envio do branch.
- README, documentação de perguntas, arquitetura, modelo de dados, servidor e desenvolvimento refletem o lote real. As 72 perguntas são apresentadas como lote inicial; partida completa com doze jogadores, 300/5.000 perguntas, seleção e início de partida continuam nas tarefas correspondentes. Nenhuma alteração de motor, contrato público ou fluxo de início foi incluída.
