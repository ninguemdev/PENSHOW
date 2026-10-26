# Acessibilidade e uso no celular

A T30 consolida a direção aprovada em D07 com a identidade do protótipo: papel claro, tinta azul, destaque amarelo e tipografia local, conforme os [tokens da interface](interface.md#tokens-e-componentes). A inspeção física permanece aberta. O navegador apresenta o estado recebido; os atalhos não alteram regras, prioridade, prazos nem pontos.

## Operação

- Tab e Shift+Tab percorrem os controles; Enter/Espaço ativam os botões. Apostas e os dois seletores de alvo usam botões nativos.
- Com foco no título da pergunta ou nas alternativas, 1 a 4 acionam a alternativa correspondente. Os números visíveis são decorativos para o leitor de tela; `aria-keyshortcuts` informa o atalho dos botões habilitados. Perguntas de duas alternativas oferecem somente 1 e 2.
- Os atalhos não operam em campos de texto, seleção, conteúdo editável, diálogos abertos, composição de texto, repetição de tecla ou combinações com modificadores. Fora da etapa, os números mantêm seu comportamento normal. Os bloqueios existentes continuam valendo para envio repetido, prazo encerrado, falta de conexão e espectador.
- Uma nova etapa foca seu título operável. A atualização não retira foco de um diálogo ou de um campo em edição. O diálogo contém Tab, fecha com Escape e restaura o acionador. Confirmações de sala continuam vinculadas à versão apresentada e fecham quando ela muda.
- Cronômetro e confirmação compartilham uma faixa que acompanha a rolagem da pergunta e das alternativas. Em janelas com até 480 px de altura, a faixa volta ao fluxo normal para não cobrir os controles.
- Na final, escolha de alvo, dano e encerramento aparecem antes da recapitulação da pergunta; enunciados extensos não empurram essas informações para depois do resumo.
- O cronômetro não anuncia cada segundo. Regiões de status anunciam confirmação, resposta correta, créditos/débitos com motivo e, na final, perda de vida, eliminação e encerramento da pergunta. Vidas, estado do jogador e penalidades também têm texto visível. A lista de vidas permanece consultável, sem reler todos os jogadores a cada dano; o anúncio informa a pessoa afetada e a mudança.
- O placar mantém cabeçalhos de tabela e rolagem horizontal local acessível por teclado, sem duplicar regiões de navegação. A página quebra textos extensos e adapta navegação, botões e legendas.
- A viewport permite ampliação e usa `viewport-fit=cover`. O corpo reserva `safe-area-inset-*`; diálogos respeitam a altura dinâmica disponível e podem rolar. Controles principais têm pelo menos 48 px; links de navegação, 44 px. A conversão de pontos em vidas respeita movimento reduzido.

## Verificação reproduzível

```sh
pnpm questions:check
pnpm build
pnpm --filter @penshow/e2e exec playwright install chromium
pnpm test:e2e:a11y
```

`accessibility.spec.ts` usa servidor, HTTP, Socket.IO e web compilada reais. A fixture privada reduz a quantidade de perguntas e amplia janelas de revisão; cria textos sintéticos de 2.000 caracteres e alternativas de 500, incluindo um trecho sem espaços. O catálogo de produção não é escrito. Respostas passam pelas ações normais e pelo cálculo oficial, sem alterar o estado para obter vitória.

Há dois percursos, repetidos nos projetos desktop e celular:

| Percurso | Verificação |
|---|---|
| Partida até o pódio | Pronto, tema, aposta e ambos os alvos alcançados com Tab/Enter; respostas por 1–4; foco automático; textos longos; cronômetro durante rolagem; movimento reduzido; vidas e pódio reais |
| Adaptação e recuperação | 320×640, 780×360, 768×1024 e 1280×900 com texto a 200%; ausência de rolagem horizontal da página; diálogo por teclado; recarga com latência de 400 ms e tráfego limitado; edição e salvamento em viewport de 320×320 |

As telas estáveis do percurso recebem varredura axe-core, incluindo contraste, nomes, semântica e boas práticas, sem excluir regras. Cada varredura anexa seu JSON e a árvore de acessibilidade do Chromium. Capturas registram as alternativas extensas e o texto ampliado. A integração segue a [documentação do Playwright](https://github.com/microsoft/playwright/blob/main/docs/src/accessibility-testing-js.md).

A CI tem um job `accessibility` e artefato `acessibilidade`, separado dos cenários históricos e das partidas completas. Os relatórios locais ficam em `e2e/playwright-report` e `e2e/test-results`, ignorados pelo Git.

## Limites e revisão complementar

A árvore do Chromium e a automação não equivalem a uma sessão com NVDA, VoiceOver ou TalkBack. As dimensões reduzidas simulam o espaço tomado por um teclado; não acionam um teclado virtual de aparelho físico. A ampliação executada é de texto a 200% com reflow em 320 px, sem afirmar zoom da interface do navegador. As safe areas foram implementadas, mas a inspeção de um recorte físico requer aparelho compatível.

Antes do aceite físico, conferir as telas em aparelho real com teclado virtual, recorte e leitor de tela, inclusive pausa/retorno e ambos os alvos. A direção D07 já está aplicada; a [ficha da revisão física](validation/t30-revisao-fisica.md) mantém cada resultado pendente até observação em aparelho.

## Foco do combate — revisão de 23/10/2026

Os atalhos WASD/setas, IJKL e Espaço só operam quando o canvas da arena tem foco. Mudar para um link, campo, botão ou diálogo zera o movimento e o disparo; voltar à arena não restaura teclas antigas. Atalhos com Ctrl/Alt/Meta e composição de texto não iniciam ações. Soltar uma tecla continua encerrando sua ação mesmo quando um modificador está pressionado. A instrução visível orienta selecionar a arena antes de usar o teclado.

A correção cobre o caso em que o listener global podia consumir setas na navegação ou manter movimento após mudar o foco. Três regressões de DOM verificam foco, diálogo e atalhos/composição. A suíte web passou com **182 testes**; após o ajuste final de soltura com modificador, as três regressões passaram novamente. Build, tipos, lint e formato foram verificados. O Canvas é substituído por contexto nulo apenas nos testes de DOM; os percursos abaixo usam o navegador e o servidor reais.

Dois percursos Playwright de combate passaram, sem retry, em **1,3 minuto**, no desktop 1280×900 e celular 360×780 emulado. Além do fluxo de combate/pergunta/pódio, o desktop segura uma tecla, transfere o foco para um link e confere a intenção neutra recebida pelo servidor; setas fora da arena não voltam a movimentar. Toque, mouse, IJKL/Espaço e auditorias axe/reflow continuam passando. Relatório preservado em `e2e/playwright-report/t30-focus-review/` e artefatos em `e2e/test-results/t30-focus-review/`.

A revisão física não foi executada: não foi identificado aparelho conectado e ainda falta informar o equipamento. A ficha separa teclado virtual, recortes, zoom nativo, leitor de tela e uso com dois dedos. Isso não altera o status de T30 para concluída.

## Registro de execução histórico

- A revisão encontrou três problemas verificáveis: regiões duplicadas no placar (`landmark-unique`), salto de nível no título das vidas (`heading-order`) e legenda fora da viewport de 320 px com texto a 200%. Corrigidos com grupo de rolagem dentro da região do placar, título de nível 2 sem desviar o foco da etapa e quebra de linha nas legendas.
- Cálculo de luminância das cores principais: texto/papel 14,97:1, auxiliar/papel 6,23:1, foco/papel 5,77:1 e texto no destaque amarelo 13,45:1. A varredura no navegador complementa esse cálculo para os elementos efetivamente renderizados.
- Quatro cenários de acessibilidade aprovados em 2,5 minutos, sem retry, nos projetos desktop e celular. Nenhuma violação detectada nas varreduras axe executadas. Os testes não certificam conformidade integral.
- Capturas de alternativas de 500 caracteres inspecionadas em 1280×900 e 360×780: palavras e trecho sem espaços quebram dentro do botão, os números continuam visíveis e o cronômetro acompanha a rolagem. Captura de lobby a 320 px com texto a 200% inspecionada: convite, participantes, preferências e início permanecem disponíveis em uma coluna.
- A suíte geral passou com 796 testes; após os dois casos adicionais de composição/repetição/pergunta booleana e ordem dos controles da final, a suíte web passou com 144 testes. Total atual: 798 (34 de conteúdo, 5 de artes, 186 de shared, 429 de server e 144 de web).
- `pnpm test:e2e:run`: 32 cenários aprovados em 27,1 minutos, sem retry, cobrindo desktop e celular, modalidades isoladas, partidas completas, reconexão e capacidade de 12. Essa execução antecede a última mudança de posição da recapitulação/cronômetro e o refinamento dos anúncios de vidas.
- Após esses ajustes, novo build aprovado e dois percursos acessíveis até o pódio aprovados em 2,3 minutos, sem retry, em desktop/celular. A verificação adicional exige ambos os seletores e o texto de pergunta encerrada inteiros na viewport. Varreduras axe sem violações detectadas. Relatório final em `e2e/playwright-report/final-review`, preservando o relatório da regressão de 32 casos no diretório pai.
- Capturas finais dos dois seletores, dano de 4 para 3 vidas e pergunta encerrada inspecionadas: controles, cronômetro e resultado aparecem antes do enunciado extenso, com foco visível. Capturas em `e2e/test-results/final-review`.
- Formatação, lint, tipos e build aprovados. A descoberta dos jobs da CI conferiu 16 casos históricos, 12 de partidas completas e 4 de acessibilidade, sem duplicação.
