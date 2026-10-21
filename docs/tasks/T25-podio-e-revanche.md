# T25 — Pódio, histórico e revanche

- **Depende de:** [T24](./T24-final-na-web.md)
- **Pacotes:** server, web, shared
- **Marco:** M3
- **Branch sugerido:** `task/25-podio-e-revanche`

O status desta tarefa fica somente no [índice](README.md). A entrega continua o protótipo isolado da T24; não consolida a sequência das cinco modalidades nem as consultas de regras ainda pendentes.

## Objetivo

Concluir a partida, explicar o resultado e permitir jogar novamente sem recriar a sala.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Derivar pódio do último sobrevivente e ordem de eliminação; apresentar placar anterior como histórico.
- [x] Exibir resumo por fase e ordem final sem recalcular vitória pelos pontos.
- [x] Implementar retorno ao lobby, nova lista de participantes e continuidade da fila de escolha de tema.
- [x] Limpar estado, timers, ações consumidas e vidas da partida encerrada, preservando perfil e sala.

## Critérios de aceite

- [x] Campeão é o último com vida, mesmo se começou a final em colocação inferior.
- [x] Espectadores e eliminados presentes podem participar da revanche.
- [x] Nova partida ganha novos IDs e não aceita comandos/timers da anterior.
- [x] Interrupção sem vencedor não produz pódio fictício.

## Verificação

- [x] Testar vitória de quem entrou em quarto, ordem de eliminação e retorno ao lobby.
- [x] Executar duas partidas consecutivas na mesma sala, incluindo jogador novo e um que saiu.

## Implementação e evidências

`features/results/podium.tsx` apresenta a ordem recebida em `podium.standings`, com entrada por classificação/vidas e condição final. O placar anterior tem título histórico, e `round-history.tsx` apresenta os resumos por fase derivados de registros já liquidados no servidor por `build-round-summaries.ts`. `roundSummarySchema` e a validação de `MatchView` conferem membros, deltas, continuidade dos saldos e totais. Não publicam perguntas, respostas privadas, recibos ou seleção editorial, nem permitem reordenar a vitória por pontos.

O retorno ao lobby permanece uma ação de serviço pela fila. Conserva sala/perfis e somente a fila privada de escolha de tema, entregue ao seletor do novo início. Saídas explícitas liberam reservas e vagas; queda de rede mantém a carência existente. Espectadores presentes ocupam vagas disponíveis e eliminados voltam como jogadores. O agregado anterior sai da sala e seu timer é cancelado. A store limpa tentativas/erros somente após fotografia autoritativa do lobby ou de outra partida, inclusive quando a visão foi descartada durante navegação; ack antigo não repõe os dados.

Os três novos testes de serviço percorrem vitória real de quem entrou em quarto, ordem de eliminação, interrupção sem vencedor e duas sequências completas de quiz isolado + final na mesma sala, com novo participante/saída. Conferem sala e perfis conservados, fila continuada, IDs novos, placar/vidas novos e rejeição de comando e timer antigos. Seis testes de contratos verificam resumos coerentes e recusam dados privados, membros duplicados, deltas e totais incompatíveis, sequência de saldo errada e exposição antes do encerramento. Quatro cenários novos da web verificam pódio/histórico/revanche, espectador, eliminado e interrupção; outro cobre limpeza após navegação e ack atrasado.

Em 20/10/2026, `pnpm test` passou com **374 testes do servidor, 175 de shared, 124 da web, 32 de conteúdo e 5 de artes**, total **710**. Formatação, lint, tipagem e build passaram. A inspeção móvel também levou ao ajuste de largura/quebra dos indicadores de posição do pódio.

`pnpm --filter @penshow/e2e exec playwright test final-smoke.spec.ts` passou em **desktop e celular emulado: dois testes, 7,3 minutos**. Cada projeto conclui duas sequências de clássico + final com servidor, catálogo e relógios reais. Na primeira, duas sessões disputam a resposta e exercitam alvo offline, perda única, eliminação e reconexão. No pódio, entra um espectador e sai o anfitrião. O eliminado prepara a revanche como novo anfitrião; o espectador é promovido e ambos jogam até o segundo pódio. O segundo colocado vence o líder em pontos, e a tela mantém a ordem correta e o placar como histórico. Conferidos IDs novos, continuidade da fila, perfis/sala preservados, teclado/toque, privacidade, recarga no pódio e ausência de rolagem horizontal. Capturas desktop/móvel de `podio-revanche.png` foram inspecionadas; relatórios e capturas estão em `e2e/playwright-report/` e `e2e/test-results/`. A descoberta automática da CI inclui esse percurso e o limite do job foi ampliado para 30 minutos para comportar as revanches.

Guia: [podio-e-revanche.md](../podio-e-revanche.md). Histórico e salas continuam em memória; voltar ao lobby descarta o resultado da partida anterior. A política de empate, as duas pausas da final e a sequência completa permanecem com os limites documentados nas tarefas anteriores.

## Cuidados de implementação

O caminho de retorno precisa ser uma ação de serviço, não limpeza manual da store pelo navegador.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
