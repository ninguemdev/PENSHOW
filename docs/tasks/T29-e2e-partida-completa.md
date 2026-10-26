# T29 — Testes ponta a ponta da partida completa

- **Depende de:** [T26](./T26-reconexao-e-ciclo-de-vida.md), [T27](./T27-catalogo-de-teste-completo.md), [T28](./T28-privacidade-limites-e-concorrencia.md), [T36](./T36-modo-classico-padrao.md)
- **Pacotes:** e2e, web, server, data
- **Marco:** M4
- **Branch sugerido:** `task/29-e2e-partida-completa`

O status desta tarefa fica somente no [índice](README.md). A matriz implementada e seus limites estão descritos em [e2e-partida-completa.md](../e2e-partida-completa.md). D01–D06 foram respondidas em 23/10/2026; a integração da T36 incorpora essas escolhas com T20/T21/T39; as evidências atuais ficam separadas da matriz histórica.

## Objetivo

Demonstrar que o modo clássico padrão da T36 funciona com navegadores e servidor reais: quatro modalidades distintas sorteadas e a final obrigatória na quinta fase. Cobrir o catálogo de modalidades entre diferentes partidas.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Cobrir criação com modo clássico padrão, cinco fases totais, placar acumulado, conversão em vidas, primeira resposta exclusiva, pódio e revanche.
- [x] Verificar quatro modalidades iniciais sem repetição, ordem sorteada igual entre clientes e final sempre na quinta posição; recarga não refaz o plano.
- [x] Consolidar a dinamite aprovada em T21 e preservar cobertura de aposta; os cenários de roubo usam teto 100 desde a T20. As evidências anteriores à consolidação continuam históricas.
- [x] Cobrir perda coletiva sem resposta na final, sorteio que inclui quem acertou e vidas iguais com posições consecutivas por grupo (sem saltos).
- [x] Cobrir o desempate de T39 em desktop/celular: grupo eliminado junto, três vidas iniciais, pergunta em zero, erro elimina e acerto devolve uma vida, repetição do ciclo, resultado e reconexão.
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

## Revalidação das políticas confirmadas — 23/10/2026

A matriz atual usa dinamite confirmada, roubo até 100 e políticas D02/D03/D06/D09 aplicadas. A regressão conjunta inclui os **12 percursos integrados**, **4 de acessibilidade**, **2 de dinamite**, **2 de final/revanche**, **2 de combate** e **10 de áudio/narrador/renderização**, distribuídos entre desktop 1280×900 e celular 360×780 emulado.

O combate acrescenta axe sem exclusões e árvore acessível em instruções, arena, pergunta de sobrevivência e pódio, além de reflow na arena e na pergunta. A validação não equivale a leitor de tela, aparelho físico ou sessões humanas. Comando reproduzível, resultados finais e demais verificações estão no [registro conjunto](../validation/t21-t36-t29.md); as evidências anteriores permanecem em suas seções históricas.

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
- Essa evidência pertence à versão anterior às respostas D02–D06; a consolidação atual usa as políticas aplicadas em T20/T21/T39 e as evidências complementares abaixo.
