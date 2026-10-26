# T24 — Final na web e visualização das vidas

- **Depende de:** [T16](./T16-quiz-classico-web.md), [T23](./T23-final-no-servidor.md)
- **Pacotes:** web
- **Marco:** M3
- **Branch sugerido:** `task/24-final-na-web`

O status desta tarefa fica somente no [índice](README.md). A implementação usa o protótipo isolado da T23 e ainda apresenta as pausas anteriores de D02/D03; as escolhas já foram respondidas e foram aplicadas na integração T39.

## Aplicação das decisões de 23/10/2026

O núcleo desta tarefa já entregue continua registrado no índice. D02/D03/D06 foram respondidas; a adaptação adicional das telas foi integrada com T39:

- [x] Mostrar perda coletiva por ausência de resposta e alvo sorteado, inclusive quando atingir quem acertou, com textos e avisos acessíveis.
- [x] Remover mensagens de decisões em consulta nos fluxos substituídos pelas políticas aprovadas; preservar estados transitórios coerentes com o servidor.
- [x] Apresentar vidas iguais e posições consecutivas por grupo (5/5/4/3/2 no exemplo com empate em 1º); mostrar encaminhamento de eliminações simultâneas ao minigame da T39 e seu resultado.
- [x] Verificar desktop/celular e reconexão no e2e T39; integrar preferências de narração e sons às novas resoluções, sem declarar escuta humana.

## Objetivo

Exibir a vantagem inicial, a disputa da primeira resposta e a escolha de alvo sem prometer prioridade antes da confirmação.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Criar instrução da final e animação informativa de pontos/colocação para vidas.
- [x] Exibir vidas, enunciado, alternativas, estado de pergunta fechada e primeiro respondente confirmado.
- [x] Disponibilizar escolha de alvo somente ao vencedor do acerto, com prazo e adversários elegíveis.
- [x] Mostrar perda de vida, eliminação e espectador com foco e avisos acessíveis.

## Critérios de aceite

- [x] Um clique não mostra sucesso de prioridade até o servidor aceitar a resposta.
- [x] Jogador eliminado assiste sem controles de resposta/ataque; reconexão restaura a tela correta.
- [x] Outros jogadores não recebem a escolha de alvo como ação habilitada.
- [x] Alterações de vida são legíveis sem depender de som, cor ou animação.

## Verificação

- [x] Testar primeiro erro, primeiro acerto, resposta rejeitada e ataque a um adversário offline.
- [x] Validar duas abas concorrendo com servidor real e interface móvel em escolha de alvo.

## Implementação e evidências

`final-entry.tsx` apresenta o retrato de classificação recebido, com pontos, colocação e vidas iniciais; `final-round.tsx` apresenta instruções, leitura, disputa exclusiva, alvo, resolução, pausas e aviso simples de sobrevivente. A animação respeita redução de movimento. As perdas e eliminações têm texto e anúncios acessíveis, e o foco acompanha a etapa. O pódio detalhado, histórico e revanche permanecem na T25.

`match-store.ts` conecta `final:start` e reutiliza `round:ready`, `answer:submit`, `target:choose` e retorno ao lobby, validando papel, participante ativo, fase, contexto e prazo. Só `first-valid` anuncia prioridade aceita. Rejeição explícita e confirmação ausente têm estados distintos. Vidas e resultado não são recalculados no navegador; alvos desconectados continuam disponíveis. A chave da tentativa inclui conexão/pergunta/etapa, preservando a proteção contra confirmações antigas.

Em 20/10/2026, `pnpm test` passou com **371 testes do servidor, 169 de shared, 119 da web, 32 de conteúdo e 5 de artes**, total **696**. Os dez cenários novos da web verificam conversão/início/prontidão, leitura, confirmação pendente/aceita, erro, rejeição, timeout, alvo offline, exclusividade, eliminação, espectador e as duas pendências. Formatação, lint, tipagem e build também passaram.

`pnpm --filter @penshow/e2e exec playwright test final-smoke.spec.ts` passou nos dois projetos, **desktop e celular emulado, em 3,7 minutos**. O percurso obtém classificação real após seis perguntas do catálogo publicado, inicia a final pela web e disputa duas respostas entre sessões independentes. Verifica primeiro erro, único autor do ataque, recarga com prazo preservado, alvo desconectado, perda única, eliminação com recuperação da tela e retorno ao lobby após o único sobrevivente. O teste usa relógios reais; a fila é retida brevemente apenas para permitir que os dois cliques concorrentes sejam enviados antes da primeira projeção, sem alterar estado ou resultado. Teclado/toque, privacidade e ausência de rolagem horizontal foram conferidos. Capturas desktop/móvel foram inspecionadas e estão em `e2e/test-results/`; o relatório está em `e2e/playwright-report/`. O job de CI existente descobre o novo teste automaticamente.

Guia: [final-na-web.md](../final-na-web.md). O botão de início depende da classificação pronta; estoque continua validado pelo servidor. Não há sequência completa de cinco fases ou publicação nesta etapa, e as decisões de produto pendentes continuam registradas em `decisoes.md`.

## Cuidados de implementação

Reutilizar componentes de pergunta, mas não o comportamento de coletar respostas de todos das fases iniciais.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
