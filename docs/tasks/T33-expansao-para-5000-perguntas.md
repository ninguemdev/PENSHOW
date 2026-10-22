# T33 — Expansão para 5.000 perguntas revisadas

- **Depende de:** [T27](./T27-catalogo-de-teste-completo.md)
- **Pacotes:** data, scripts, docs
- **Marco:** M6
- **Branch sugerido:** `task/33-expansao-para-5000-perguntas`

O status desta tarefa fica somente no [índice](README.md). O [relatório da expansão](../expansao-editorial-t33.md) registra o primeiro lote, a auditoria e os limites reais. O catálogo tem 336 aprovadas; a meta de 5.000 ainda não foi atingida.

## Objetivo

Cumprir a meta de conteúdo amplo em português, mantendo variedade e qualidade factual.

## Leia antes

- [perguntas.md](../perguntas.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Entregáveis

- [ ] Expandir em lotes identificados até pelo menos 5.000 perguntas aprovadas em pt-BR, combinando fontes licenciadas e revisadas.
- [ ] Traduzir e adaptar o conteúdo necessário, com atribuição e licença de cada base preservadas.
- [ ] Distribuir conteúdo por tema e dificuldade, com relatório de temas novos e de capacidade para partidas consecutivas.
- [ ] Manter revisão factual e editorial por registro, remoção de duplicatas por sentido e histórico de correções.
- [x] Publicar o lote `t33-001`: 36 traduções com revisão individual e duas duplicatas rejeitadas, preservando as 300 anteriores.
- [x] Preparar auditoria de lotes com versões anterior/revisada, procedência, data, comparação semântica declarada e detecção de alterações fora do histórico.
- [x] Registrar distribuição, backlog, falta mínima de candidatos adicionais e capacidade mecânica para partidas consecutivas.

## Critérios de aceite

- [ ] A contagem de 5.000 considera somente registros aprovados e publicáveis, não a disponibilidade anunciada por uma API.
- [ ] O banco oferece volume útil nos temas habilitados, em vez de concentrar quase tudo numa única categoria.
- [ ] Perguntas voláteis têm período explícito ou são rejeitadas; títulos e nomes são adaptados com critério.
- [ ] Cada lote pode ser revisado e validado separadamente; a tarefa só termina quando o total e a qualidade forem atingidos.

## Verificação

- [ ] Executar validação/publicação por lote e auditoria de contagem, idioma, fonte e dificuldade.
- [ ] Revisar amostras de cada tema e traduções, além dos casos detectados automaticamente.

## Cuidados de implementação

Não aprovar milhares de registros por alteração em massa de status. Conteúdo pode avançar junto do produto; um piloto com 300 não significa que esta meta esteja concluída.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências do primeiro lote — 22/10/2026

- [Lote editorial](../../data/editorial-batches/t33-001.json): 38 decisões, sendo 36 aprovadas/traduzidas e duas rejeições por duplicidade com a T11/T27. Revisão assistida por IA com referências acessíveis ou indexadas; sem auditoria humana independente.
- Seis novas perguntas por tema, duas por dificuldade. Catálogo atual: 336 perguntas, 56 por tema, preservando Questionados/MIT e acrescentando Open Trivia DB/CC BY-SA 4.0. Sem novas importações ou temas habilitados.
- `questions:audit` verifica histórico e publicação; `--batch=t33-001` verifica o lote dentro do histórico global; `--check` verifica os bytes sem escrever. Check global incorporado à CI.
- `questions:capacity` executa 280 percursos de seleção oficial contra a publicação atual, sem repetir IDs entre partidas e com cenário explícito de 50 perguntas na final. Com os seis temas, três partidas para 2/4/8 e duas a três para 12 pessoas. Não limita a final do produto nem garante duração de partidas reais.
- Os relatórios T27/T36/T32 usam o snapshot privado de 300 perguntas original. O catálogo publicado continua sendo a única origem de conteúdo do servidor.
- Faltam 4.664 publicáveis. Os 1.193 candidatos sem decisão deixam necessidade mínima de 3.471 candidatos novos, mesmo com aprovação de todos. A meta e os critérios globais continuam pendentes.
- Validação local: 831 testes aprovados (41 de conteúdo, cinco de artes, 186 compartilhados, 436 do servidor e 163 da web), lint, tipos, build, formatação, publicação/auditoria e capacidade com `--check`. T27/T36 reproduzidos com `--check`; snapshot histórico comparado byte a byte com o catálogo anterior. A reprodução integral do piloto T32 e os E2E ficam também na CI do PR.
