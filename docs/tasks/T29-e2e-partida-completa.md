# T29 — Testes ponta a ponta da partida completa

- **Depende de:** [T26](./T26-reconexao-e-ciclo-de-vida.md), [T27](./T27-catalogo-de-teste-completo.md), [T28](./T28-privacidade-limites-e-concorrencia.md), [T36](./T36-modo-classico-padrao.md)
- **Pacotes:** e2e, web, server, data
- **Marco:** M4
- **Branch sugerido:** `task/29-e2e-partida-completa`

O status desta tarefa fica somente no [índice](README.md). A matriz implementada e seus limites estão descritos em [e2e-partida-completa.md](../e2e-partida-completa.md). A integração experimental da T36 está disponível; sua consolidação e as variantes definitivas D04/D05 continuam pendentes.

## Objetivo

Demonstrar que o modo clássico padrão da T36 funciona com navegadores e servidor reais: quatro modalidades distintas sorteadas e a final obrigatória na quinta fase. Cobrir o catálogo de modalidades entre diferentes partidas.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Cobrir criação com modo clássico padrão, cinco fases totais, placar acumulado, conversão em vidas, primeira resposta exclusiva, pódio e revanche.
- [x] Verificar quatro modalidades iniciais sem repetição, ordem sorteada igual entre clientes e final sempre na quinta posição; recarga não refaz o plano.
- [ ] Adicionar cenários de aposta, roubo e dinamite com as variantes confirmadas em D04/D05. As variantes experimentais já estão cobertas; confirmação de produto permanece pendente.
- [x] Exercitar reconexão, anfitrião ausente e rejeição de respostas/ataques repetidos.
- [x] Expandir CI com fixtures isoladas, artefatos de falha e verificação de catálogo/assets.

## Critérios de aceite

- [x] O fluxo completo usa o cálculo real dos serviços, sem mockar vitória ou pular efeitos de regras.
- [x] Testes são reproduzíveis e não usam serviços externos de perguntas.
- [x] Formato acelerado para teste preserva as regras e não altera os parâmetros da produção.
- [x] Documentar falha real e diagnóstico quando um cenário não passar; não marcar sucesso apenas por compilar.

## Verificação

- [x] Executar o percurso completo com duas identidades em navegadores e os cenários de falha prioritários.
- [x] Cobrir capacidade de 12 por integração real de sockets; complementar com teste manual do navegador para não multiplicar custo sem ganho.

## Cuidados de implementação

Evitar sleeps e dependência da duração normal de uma partida. Usar estados observáveis e perfil de timing exclusivo para testes.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências da matriz experimental

- Branch `task/29-e2e-partida-completa`; alterações anteriores preservadas.
- [Matriz e operação dos testes](../e2e-partida-completa.md): duas ordens controladas cobrindo as cinco modalidades, apostas reais de 0/50, transferência conservada, uma perda por ataque, recarga, pódio e revanche.
- Três casos T29 em `match.realtime.test.ts` aprovados em execução focada (38,95 s): 12 identidades percorrem a partida inteira com anfitrião ausente, conexão substituída, respostas concorrentes e ataques repetidos; dois percursos verificam pausas D02/D03 sem dano. Catálogo publicado, comandos e cálculos oficiais, sem alterar agregados para simular vitória.
- A suíte geral passou com 788 testes: 34 de conteúdo, 5 de artes, 186 de shared, 429 de server e 134 de web.
- `pnpm test:e2e:classic`: 12 testes aprovados em 3,9 minutos, sem retry; seis cenários em desktop e celular, incluindo as duas partidas completas, falhas prioritárias e inspeção do grupo de 12. A execução anterior dos dez cenários sem a inspeção de capacidade também passou (3,8 minutos).
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm questions:check` e `pnpm avatars:check` aprovados. O seletor da CI foi conferido com `--list`: 16 históricos e 12 integrados.
- Inspeção assistida de `grupo-12-dinamite.png` em desktop e celular: 12 nomes/avatares, placar e indicação dos 24 turnos legíveis; sem rolagem horizontal da página. Dois navegadores e dez convidados por HTTP/socket reais, sem afirmar teste com 12 pessoas.
- CI dividida entre `smoke` e `full-match`, com verificação de catálogo/artes, fixtures isoladas e artefatos públicos de falha. A descoberta conferiu 16 testes históricos e 12 integrados, sem duplicação. A CI hospedada não foi executada nesta tarefa.
- A aceitação definitiva continua condicionada às escolhas D02–D06 e à consolidação da T36. Não considerar a execução experimental como aprovação dessas regras.
