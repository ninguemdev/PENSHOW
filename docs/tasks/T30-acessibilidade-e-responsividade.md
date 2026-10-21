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

## Decisões em consulta

D07 orienta as artes e a identidade definitiva. Acessibilidade, foco, contraste e responsividade não dependem dessa escolha.

## Entregáveis

- [x] Revisar telas em celular, tablet e desktop emulados, textos longos e espaço reduzido para digitação; implementar safe areas. Inspeção física permanece na revisão complementar.
- [x] Validar foco, navegação, atalhos 1 a 4, avisos de resultado e interação de aposta/alvo.
- [x] Aplicar contraste, ícones/textos além de cor, redução de movimento e tamanhos de toque adequados.
- [x] Revisar instruções de respostas, roubo e pausas da final, preservando a indicação de regras em consulta.
- [ ] Finalizar identidade visual conforme D07.

## Critérios de aceite

- [x] É possível jogar usando só teclado; foco não fica preso nem dispara resposta quando digitando em outro campo.
- [x] Enunciados e alternativas longas não escondem confirmação, cronômetro ou controles essenciais nas viewports verificadas.
- [x] Vidas, penalidades e pergunta fechada são compreensíveis com som silenciado e animação reduzida.

## Verificação

- [x] Testar telas reais com árvore de acessibilidade e varredura axe-core, sem excluir regras.
- [x] Exercitar retrato/paisagem, texto a 200% e conexão lenta, incluindo os dois seletores de alvo; inspecionar capturas em desktop e celular.
- [ ] Complementar a emulação com aparelho físico, teclado virtual, recorte/safe areas, leitor de tela e zoom nativo do navegador. Essa validação não foi simulada como concluída.

## Cuidados de implementação

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
- A aceitação definitiva permanece aberta para D07 e a revisão complementar em aparelho físico descrita acima.
- A validação dos PRs em Linux detectou overflow do cabeçalho a 200% com fonte alternativa e uma tecla enviada antes de habilitar as alternativas no relógio do cliente. O cabeçalho permite quebra dentro da largura disponível; a regressão inclui Arial a 320 px. O percurso de teclado aguarda a alternativa habilitada, mantendo as verificações de foco, prazo e efeitos reais, sem sleeps ou relaxamento de critérios.
