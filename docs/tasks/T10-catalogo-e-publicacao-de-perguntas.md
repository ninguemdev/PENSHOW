# T10 — Catálogo privado e publicação editorial

- **Depende de:** [T02](./T02-contratos-e-documentacao.md)
- **Pacotes:** server, scripts, data; web para bloqueio de arquivos privados no desenvolvimento
- **Marco:** M2
- **Branch sugerido:** `task/10-catalogo-e-publicacao-de-perguntas`

O status desta tarefa fica somente no [índice](README.md). As evidências abaixo descrevem os arquivos implementados e as verificações executadas.

## Objetivo

Separar candidatos importados das perguntas aprovadas carregadas pelo servidor.

## Leia antes

- [perguntas.md](../perguntas.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Evoluir validadores existentes para revisão com referência, data, dificuldade, categoria e resposta única.
- [x] Definir catálogo publicado em diretório separado e comando determinístico para gerá-lo de registros aprovados.
- [x] Criar repositório de leitura do catálogo com interface pequena e implementação local.
- [x] Manter procedência/licença por registro e relatórios de rejeições, duplicatas e disponibilidade por tema/dificuldade.

## Critérios de aceite

- [x] Candidata, tradução incompleta, pergunta sem revisão e registro rejeitado nunca entram no catálogo publicado.
- [x] Publicação falha visivelmente se o gabarito ou a procedência forem inválidos.
- [x] Dados publicados para o servidor não entram em shared nem em `apps/web/public`.

## Verificação

- [x] Testar promoção e recusa de registros, duas alternativas equivalentes e gabarito inexistente.
- [x] Testar compilação repetida com saída estável e carregamento com erro de arquivo.

## Cuidados de implementação

Aproveitar `scripts/lib/questions.mjs` e os importadores atuais; não reescrevê-los sem motivo. Validação estrutural não aprova a verdade da resposta.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 17/10/2026

- Branch `task/10-catalogo-e-publicacao-de-perguntas`, preservando as entregas anteriores no workspace. Nenhum candidato real foi aprovado ou alterado: permanecem 531 registros em português para revisão e 1.000 em inglês para tradução. O primeiro lote factual é a T11.
- `modules/questions/editorial-question.schema.ts` contém os schemas privados, usados pelo servidor e reexportados por `scripts/lib/questions.mjs`. Parser, normalização, IDs determinísticos e importadores existentes foram preservados. Aprovação agora exige pt-BR, dificuldade revisada, referência HTTP(S), data de calendário válida e conferência explícita de fatos, idioma e resposta única. Campos desconhecidos, HTML pendente, alternativas equivalentes, gabaritos ausentes e procedência malformada são recusados. A declaração de revisão não comprova a verdade do conteúdo.
- `scripts/lib/question-publication.mjs` e `scripts/publish-questions.mjs` compilam somente registros aprovados de `data/questions/reviewed/`, conferindo ID/procedência com um candidato único e licença do manifesto. Candidatos não são entrada de promoção, mesmo com status `approved`. Pendentes/rejeitados ficam fora; tentativa de aprovação inválida retorna falha e registra diagnóstico.
- `pnpm questions:publish` gera `data/questions/published/catalog.json`, com manifesto embutido, contagem, disponibilidade por tema/dificuldade, hash canônico, registros privados e atribuição/licença das fontes utilizadas. Ordenação explícita e quebras de linha LF das licenças garantem estabilidade entre execuções, sem timestamp/caminho absoluto na saída. Duplicatas de ID ou enunciado aprovado exigem decisão editorial. Arquivo temporário e renomeação no mesmo diretório preservam o catálogo anterior se uma aprovação falhar.
- `data/publication-reports/questions.json` registra contagens de candidatos/revisados, exclusões, erros, duplicatas e disponibilidade da tentativa. `questions:validate` também verifica os registros revisados; `questions:check` recompila e compara os bytes de catálogo/relatório sem escrever. Esse check foi acrescentado à CI. O catálogo inicial e sua disponibilidade são explicitamente vazios, com zero aprovadas.
- `QuestionRepository` oferece `list({ category?, difficulty? })` e `availability()`. `LocalQuestionRepository` lê somente o arquivo publicado, confere esquema/manifesto/hash/licenças/duplicatas e mantém consultas em memória com cópias isoladas. Tamanho acima de 32 MiB, arquivo ausente, diretório, JSON malformado ou dados inconsistentes causam erro fixo. `buildApp` carrega antes de aceitar requisições e antes da varredura de sessões; `main.ts` distingue essa falha de erro de porta. Repositório/caminho são injetáveis para testes, sem novos endpoints públicos.
- Os scripts usam a remoção nativa de tipos do Node 24 para reutilizar os schemas privados sem um build prévio. `rewriteRelativeImportExtensions` mantém imports `.js` no servidor compilado. Não foram adicionadas dependências nem tipos editoriais ao shared.
- Testes editoriais usam somente fixtures sintéticas: promoção válida, exclusão por pasta/status, revisão/idioma/dificuldade/data inválidos, origem/índice/licença alterados, duas alternativas equivalentes, gabarito inexistente, duplicatas, arquivos/licenças ausentes, JSON inválido, publicação repetida, normalização LF/CRLF, check sem escrita e preservação dos bytes anteriores em toda tentativa inválida. Publicação redirecionada por link de diretório para `apps/web/public` é recusada.
- Testes do leitor verificam filtros, cópias independentes, catálogo vazio, tamanho excessivo, arquivo inválido/ausente, alteração de hash/manifesto/revisão/gabarito/atribuição, recarga inválida, startup recusado sem varreduras pendentes, injeção da porta e ausência de endpoint HTTP de catálogo.
- Uma requisição real ao Vite revelou que `/@fs` servia o catálogo privado apesar de ele estar fora de `public` (HTTP 200). A configuração agora preserva as exclusões padrão e bloqueia perguntas, relatórios de importação/publicação e arquivos do servidor. Um teste com Vite real verifica HTTP 403 nesses caminhos, mantendo HTTP 200 na página, módulo de entrada e shared. O setup de testes passou a admitir esse teste Node sem exigir DOM.
- Smoke do JavaScript compilado: caminho padrão carregado com `cwd` fora do projeto, catálogo sintético aprovado em arquivo temporário, consulta privada por tema, disponibilidade, sessões HTTP e criação de lobby com cliente Socket.IO real. Gabaritos/registro sentinela não apareceram em HTTP, visão da sala ou bundle web; IDs de candidato real também foram procurados no bundle. Comandos de partida continuam indisponíveis. Conexões, aplicação e diretório temporário foram encerrados/removidos.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm questions:validate`, `pnpm questions:publish`, `pnpm questions:check`, `pnpm build`, `pnpm install --frozen-lockfile` e `git diff --check` passaram. **440 testes**: 159 shared, 169 server, 75 web, 32 de conteúdo/publicação e cinco de artes. A execução hospedada da CI depende do envio do branch.
- [Perguntas](../perguntas.md), [modelo de dados](../modelo-de-dados.md), [servidor](../servidor.md), arquitetura, desenvolvimento, interface e README atualizados. Não há seleção, IDs públicos embaralhados, conteúdo jogável ou início de partida implementados por esta tarefa; continuam nas tarefas correspondentes.
