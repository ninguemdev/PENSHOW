# T26 — Reconexão em todas as fases e ciclo de vida

- **Depende de:** [T25](./T25-podio-e-revanche.md), [T18](./T18-fase-velocidade.md), [T19](./T19-fase-aposta.md), [T20](./T20-fase-roubo.md), [T21](./T21-quinta-fase-pressao.md)
- **Pacotes:** server, web, shared, docs
- **Marco:** M4
- **Branch sugerido:** `task/26-reconexao-e-ciclo-de-vida`

O status desta tarefa fica somente no [índice](README.md). A matriz e a implementação cobrem os protótipos isolados, final e pódio já disponíveis. Não consolidam as variantes/regras ainda pendentes nem a sequência completa das cinco modalidades.

## Objetivo

Manter estado e permissões consistentes durante quedas, troca de aba, ausência do anfitrião e sala vazia.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)
- [analise-comicle.md](../analise-comicle.md)

## Entregáveis

- [x] Construir matriz de reconexão por instrução, tema, leitura, resposta, aposta, roubo, dinamite, final e pódio.
- [x] Implementar reentrada com mesma identidade, fotografia atual e descarte de views/timers antigos.
- [x] Aplicar transferência de anfitrião, carência de sala sem conectados e retomada no próximo passo pendente.
- [x] Documentar a matriz e o encerramento após reinício em `docs/cenarios-de-reconexao.md`.

## Critérios de aceite

- [x] Reconectar não devolve aposta, tentativa, direito de ataque consumido, pontuação ou vidas perdidas.
- [x] Não existem dois controladores ativos para a mesma identidade.
- [x] Sala sem conectados resolve a janela atual e não abre outra pergunta enquanto aguarda retorno.
- [x] Reinício não promete recuperar uma partida que só existia em memória.

## Verificação

- [x] Cobrir queda antes/depois do envio, entre resposta e ataque, durante dinamite e no pódio.
- [x] Testar retorno antes/depois dos 120 s propostos e anfitrião antes/depois da carência de 30 s com relógio controlado.

## Implementação e evidências

Matriz: [cenarios-de-reconexao.md](../cenarios-de-reconexao.md). `match-presence.ts` define fronteiras sem nova pergunta. O serviço resolve a janela atual, conserva estado/prazo ao suspender e retoma o próximo passo pela fila após retorno, sem consumir novamente respostas, apostas, transferências ou vidas. A projeção opcional `waitingForPlayers` informa a espera; a web bloqueia comandos até a visão atual. D02/D03 permanecem pendências explícitas.

`RoomService.sync` e `room:sync` consultam somente a associação da identidade autenticada, publicam fotografia nova ou confirmam ausência. Expiração e transferência de anfitrião são reconferidas por prazos absolutos, inclusive com callbacks atrasados. A web descarta cache ausente e consultas antigas, preserva perfil/sessão válida e registra versões máximas mesmo após navegação. Credencial recusada no handshake encerra a sessão; falha transitória não apaga identidade. Reinício perde salas e sessões em memória, com perfil local independente.

Os testes de serviço exercitam cinco modalidades com sala vazia, fronteiras de instrução/tema/aposta, retorno antes do prazo, resolução final, D02/D03 e callbacks antigos. Os limites de 29.999/30.000 e 119.999/120.000/120.001 ms são verificados com relógio controlado. A matriz Socket.IO em WebSocket/polling cobre instrução, tema, leitura, resposta antes/depois do envio, aposta privada, roubo, dinamite, conexão substituída, espera/retomada e expiração. Outro aplicativo recusa a credencial anterior após reinício. A web cobre consulta ausente, atrasada/falha, versão antiga após navegação e bloqueio da espera.

Em 20/10/2026, `pnpm --filter @penshow/e2e exec playwright test reconnection-smoke.spec.ts final-smoke.spec.ts` passou nos projetos **desktop e celular emulado: quatro testes em 8,9 minutos**. O percurso de reconexão conserva resposta/prazo após recarga, deixa a sala vazia resolver uma pergunta, verifica suspensão sem outra seleção, retorna antes do TTL, transfere anfitrião após a carência e substitui a aba sem devolver a resposta consumida. O percurso de final/revanche conserva direito de alvo, dano, eliminação e pódio nas duas partidas consecutivas. As capturas `reconexao.png` de ambos os projetos foram inspecionadas; os relatórios/capturas ficam em `e2e/playwright-report/` e `e2e/test-results/`.

`restart-smoke.spec.ts` também passou em **desktop e celular emulado: dois testes em 9,6 segundos**. Reinicia o aplicativo no mesmo endereço do backend, verifica sala vazia e recusa da sessão anterior na interface, mantendo o apelido salvo. Evidências adicionais ficam em `e2e/playwright-report/restart/` e `e2e/test-results/restart/`. A CI existente descobre os novos testes automaticamente.

A execução completa de `pnpm test` passou com **740 testes**: 396 do servidor, 131 da web, 176 compartilhados, 32 de conteúdo e cinco de artes. Os testes de servidor e web usam até dois workers por pacote para evitar excesso de processos na execução simultânea, mantendo o prazo individual dos testes. `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` e `git diff --check` também passaram.

## Cuidados de implementação

Definir regra de cada célula antes de corrigir com condicionais locais. Contratos de sessão e fila de sala são reaproveitados, não duplicados.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
