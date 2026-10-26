# T33 — Segundo lote e validação do catálogo

Data: 23/10/2026. O catálogo privado passou de 336 para **348 perguntas aprovadas**, com **58 em cada tema**. A meta de 5.000 permanece pendente; faltam 4.652 aprovações.

## Entrega

- [Lote `t33-002`](../../data/editorial-batches/t33-002.json): 12 aprovações, sendo dez traduções, e 12 rejeições individuais. Antes/depois, referências, procedência, justificativa e comparação semântica constam por registro. Revisão assistida por IA, sem auditoria humana independente.
- Coleta Open Trivia DB ampliada para 5.230 candidatas únicas, preservando as 1.000 anteriores. Com as 531 do Questionados, são 5.761 candidatas; 5.399 ainda não têm decisão. Nenhuma nova importação foi aprovada automaticamente.
- [Manifesto histórico da T27](../../data/editorial-baselines/t27-sources.json) conservado com o hash já registrado naquela revisão. O teste confere os bytes reconstruídos da coleta original, permitindo acréscimos posteriores sem aceitar alterações nos registros antigos.
- Bloqueio de toda a pasta privada `data` no Vite, cobrindo também lotes editoriais e baselines com gabaritos. Teste HTTP confirma respostas 403 por `/@fs` e acesso normal à aplicação e ao pacote compartilhado.
- Publicação privada, auditoria e capacidade atualizadas. As 348 narrações foram geradas localmente, sem alternativas ou gabaritos. Os relatórios históricos de T27/T36/T32 não foram reescritos.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| `pnpm test` | 905 testes aprovados: 43 de conteúdo, cinco de artes, 193 compartilhados, 482 do servidor e 182 da web |
| `pnpm lint` | Aprovado |
| `pnpm typecheck` | Aprovado |
| `pnpm build` | Aprovado; Vite mantém aviso de chunk JavaScript acima de 500 kB |
| `pnpm format:check` | Aprovado |
| `pnpm questions:validate` | Aprovado |
| `pnpm questions:check` | Publicação reproduzida sem diferenças |
| `pnpm questions:audit --check` | Histórico e relatório reproduzidos sem diferenças |
| `pnpm questions:audit --batch=t33-002` | 12 aprovadas, 12 rejeitadas e dez traduções |
| `pnpm questions:capacity --check` | 280 percursos reproduzidos sem diferenças |
| Playwright: `classic-smoke.spec.ts` e `narrator.spec.ts` | Quatro percursos aprovados, desktop e celular emulado, sem retry; 2,9 minutos |
| `git diff --check` | Aprovado |

Relatório de navegador em `e2e/playwright-report/t33-catalog-review/index.html`; resultados em `e2e/test-results/t33-catalog-review/`. O quiz percorreu perfil, convite, recarga, duas identidades e seis perguntas reais. O narrador usou WAV local e conferiu ausência de repetição por presença/recarga. O celular deste teste é emulado.

Com os seis temas, a simulação atual permite três partidas consecutivas para 2/4/8/12 participantes, sem repetir IDs entre partidas no percurso. O cenário consome exatamente 50 perguntas por final simulada. Tema isolado continua sem estoque suficiente; não houve medição de duração com pessoas.

## Aceites que continuam abertos

- T30: aparelho físico, teclado virtual, leitor de tela e zoom nativo, conforme [ficha de revisão](t30-revisao-fisica.md).
- T31: escuta humana para intensidade percebida, conforto e sobreposição.
- T32: sessões observadas com 2/4/8 pessoas, incluindo combate e recuperação por pergunta.
- T33: mais 4.652 aprovações, mantendo tradução, revisão factual, diversidade e remoção de duplicatas por sentido. O número de candidatas não atesta que todas são publicáveis.

T35 continua por último, após criação da VM e atendimento das dependências. Esta validação não publica a aplicação nem substitui os aceites presenciais.
