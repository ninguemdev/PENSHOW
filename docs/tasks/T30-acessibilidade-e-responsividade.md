# T30 — Acessibilidade, celular e acabamento visual

- **Depende de:** [T25](./T25-podio-e-revanche.md), [T18](./T18-fase-velocidade.md), [T19](./T19-fase-aposta.md), [T20](./T20-fase-roubo.md), [T21](./T21-quinta-fase-pressao.md)
- **Pacotes:** web, assets
- **Marco:** M5
- **Branch sugerido:** `task/30-acessibilidade-e-responsividade`

O status desta tarefa fica somente no [índice](README.md). A implementação e os limites da verificação estão registrados em [acessibilidade](../acessibilidade.md).

## Objetivo

Concluir uma interface legível e operável em todas as fases, com visual consistente e estados claros.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)
- [decisoes.md](../decisoes.md)

## Direção visual — resposta de 23/10/2026

D07 aprova a proposta de definir a direção visual a partir do protótipo. A resposta não escolhe uma nova paleta nem confirma uma identidade final específica. A identidade aplicada conserva os tokens do protótipo: tinta `#17263c`, papel `#fffdf7`, fundo `#f6f3eb`, destaque `#fbc65b`, foco `#2463bb` e tipografia local Trebuchet MS/Segoe UI. A escolha concreta está registrada em [interface](../interface.md#tokens-e-componentes), sem apresentar a resposta de D07 como seleção explícita dessas cores. Acessibilidade, foco, contraste e responsividade seguem independentes.

## Entregáveis

- [x] Revisar telas em celular, tablet e desktop emulados, textos longos e espaço reduzido para digitação; implementar safe areas. Inspeção física permanece na revisão complementar.
- [x] Validar foco, navegação, atalhos 1 a 4, avisos de resultado e interação de aposta/alvo.
- [x] Aplicar contraste, ícones/textos além de cor, redução de movimento e tamanhos de toque adequados.
- [x] Revisar instruções de respostas, roubo e pausas da final, refletindo as regras confirmadas de D02–D06 e o desempate D09; textos de estados legados permanecem separados.
- [x] Consolidar a identidade do protótipo conforme D07, com tokens, tipografia e componentes documentados.

## Critérios de aceite

- [x] É possível jogar usando só teclado; foco não fica preso nem dispara resposta quando digitando em outro campo.
- [x] Enunciados e alternativas longas não escondem confirmação, cronômetro ou controles essenciais nas viewports verificadas.
- [x] Vidas, penalidades e pergunta fechada são compreensíveis com som silenciado e animação reduzida.

## Verificação

- [x] Testar telas reais com árvore de acessibilidade e varredura axe-core, sem excluir regras.
- [x] Exercitar retrato/paisagem, texto a 200% e conexão lenta, incluindo os dois seletores de alvo; inspecionar capturas em desktop e celular.
- [ ] Complementar a emulação com aparelho físico, teclado virtual, recorte/safe areas, leitor de tela e zoom nativo do navegador. Essa validação não foi simulada como concluída.

## Complemento de foco — 23/10/2026

Corrigidos os atalhos do combate para operar somente com foco na arena e zerar movimento/disparo ao sair dela. Links, diálogos e atalhos do navegador preservam seus comportamentos; soltar uma tecla com modificador também encerra a ação. A instrução explica como ativar o teclado da arena.

Validação: **182 testes web** aprovados e regressão focada de três casos após o último ajuste; **2 percursos de navegador** aprovados em **1,3 minuto**, desktop e celular emulado, com servidor oficial, mouse/toque, IJKL/Espaço, foco transferido e intenção neutra confirmada no servidor. Build, tipos, lint, formato e whitespace verificados. Evidências e limites no [guia de acessibilidade](../acessibilidade.md).

A [ficha de revisão física](../validation/t30-revisao-fisica.md) está preparada e **não executada**. A T30 conserva o item de hardware/leitor de tela/zoom nativo pendente, aguardando aparelho e observações reais.

## Cuidados de implementação

A revisão de 23/10/2026 registra os tokens concretos da identidade e amplia a auditoria para o combate: instruções, arena, pergunta de sobrevivência e pódio com axe sem exclusões, árvore acessível e reflow. A checagem de controles contempla mouse/toque e mira/disparo por teclado. Resultados finais e limites ficam no [registro conjunto](../validation/t21-t36-t29.md). O item de aparelho físico continua pendente.

Não substituir conteúdo por animação. Componentes comuns corrigem comportamento comum; variações de modalidade ficam em features próprias.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências da implementação

- Branch `task/30-acessibilidade-e-responsividade`; alterações das tarefas anteriores preservadas.
- Componentes comuns de alternativas e confirmação, atalhos restritos à etapa, proteção de digitação/diálogo e anúncio persistente dos resultados. Ações continuam nas stores e no protocolo existentes.
- Cronômetro antes dos textos extensos durante leitura/resposta; alvos e resultado da final antes da recapitulação. Melhorias de quebra de linha, foco, áreas de toque, safe areas e altura disponível do diálogo.
- Dez casos novos de interface cobrem as quatro teclas, bloqueios, composição/repetição, pergunta booleana, foco protegido, anúncio de penalidade/vidas e ordem dos controles da final. Suíte web: 144 testes aprovados.
- Quatro casos de navegador, varredura axe sem exclusões, árvore acessível e capturas; operação e limites em [acessibilidade](../acessibilidade.md). Job próprio na CI, com artefato de diagnóstico. A CI hospedada não foi executada localmente.
- Regressão com 32 cenários de navegador aprovada em desktop/celular, sem retry. O registro distingue essa execução da revisão focada após o último ajuste visual.
- Após o último ajuste, build e dois percursos acessíveis até o pódio aprovados em desktop/celular, sem retry; capturas dos alvos e resultado inspecionadas. Formatação, lint e tipos aprovados.
- A direção de D07 foi concretizada nos tokens existentes; a aceitação definitiva permanece aberta para a revisão complementar em aparelho físico descrita acima.
- A validação dos PRs em Linux detectou overflow do cabeçalho a 200% com fonte alternativa e uma tecla enviada antes de habilitar as alternativas no relógio do cliente. O cabeçalho permite quebra dentro da largura disponível; a regressão inclui Arial a 320 px. O percurso de teclado aguarda a alternativa habilitada, mantendo as verificações de foco, prazo e efeitos reais, sem sleeps ou relaxamento de critérios.
