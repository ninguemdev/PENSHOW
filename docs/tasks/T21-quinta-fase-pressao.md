# T21 — Quinta fase de pressão e dinamite

- **Depende de:** [T17](./T17-primeiro-marco-jogavel.md), [T13](./T13-pontuacao-e-parametros.md)
- **Pacotes:** server, web, shared
- **Marco:** M3
- **Branch sugerido:** `task/21-quinta-fase-pressao`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Implementar a quinta modalidade com oportunidades equivalentes e prazo individual completo.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [decisoes.md](../decisoes.md)

## Decisões em consulta

D04 escolhe dinamite, destaque simultâneo ou sequência. Esta ficha descreve a dinamite proposta; atualizar a ficha se a escolha mudar, mantendo sua posição na sequência.

Foi implementado um protótipo isolado de dinamite em desenvolvimento/teste. D04 continua em consulta e a tarefa permanece em andamento até a escolha da quinta modalidade. O protótipo não representa aprovação da proposta.

## Entregáveis

- [ ] Consolidar a quinta modalidade após a escolha de D04.
- [x] Para dinamite, agendar dois ciclos, uma pergunta média e uma difícil por participante, com ordem sorteada e segundo ciclo inverso.
- [x] Autorizar resposta apenas ao dono do turno; conceder dez segundos completos após a leitura.
- [x] Aplicar +300 por acerto ou débito de até 150 por erro/ausência, preservando saldo mínimo zero.
- [x] Mostrar dono, ciclo, pavio individual, passagem ou explosão e próximo turno; integrar ao resultado da quinta fase.

## Critérios de aceite

- [x] Cada participante recebe dois turnos mesmo quando erra ou está temporariamente ausente.
- [x] Explosão não remove da partida nem tira vida; próximo jogador não recebe prazo restante do anterior.
- [x] Ordem de turnos independe da ordem de respostas e do anfitrião.
- [x] Repetir um comando não passa dois turnos nem aplica duas penalidades.

## Verificação

- [x] Testar 2, 4 e 12 participantes, quantidade de turnos e distribuição de dificuldade.
- [x] Testar erro/timeout com saldo 50, acerto, envio por outro jogador e prazo completo após explosão.

## Implementação e evidências do protótipo

`pressureStrategy` usa o domínio de pontuação da T13. `pressure-turns.domain.ts` deriva dono, dificuldade, ciclo e próximo jogador de uma permutação sorteada uma única vez e do histórico confirmado. O segundo ciclo é inverso, com uma pergunta média e uma difícil por pessoa. Só o dono gera recibo; acerto, erro ou prazo encerram um turno. Explosão não elimina ninguém, e a leitura seguinte abre dez segundos novos.

`match:start` aceita `pressure`, com seleção `pressure-prototype` e índice de domínio 5. `pressureRules` e `pressureTurn` publicam parâmetros experimentais e turno atual/próximo; ordem completa e gabarito antecipado continuam privados. Os schemas validam respondente exclusivo, janela, dificuldade, progresso e efeitos. O lobby oferece **Iniciar dinamite de teste**; a UI mostra dono, ciclo, pavio individual, passagem/explosão e próximo turno, com controles restritos ao dono.

Domínio cobre saldo 50, zero, crédito 300, prazo exato, timer atrasado/antigo, identidade, reenvio e preservação do próximo prazo. Serviço percorre 2, 4 e 12 participantes com catálogo sintético aprovado de teste: 4, 8 e 24 perguntas distintas, ordem inversa e 600 pontos máximos por pessoa. Outro cenário mantém jogador desconectado durante os dois ciclos e confirma todos os turnos, com saldo zero. O catálogo publicado atual tem difíceis suficientes para duas pessoas; grupos maiores dependem da ampliação editorial da T27.

Socket.IO verifica WebSocket/polling, espectadores, injeção de identidade, conexão substituída, prazo recuperado e ausência. Web cobre início, instruções, dono/ciclo, teclado, indisponibilidade para outros/espectador, resposta incerta e explosão. Os testes automatizados passaram: **328 do servidor, 165 de shared, 109 da web, 32 de conteúdo e 5 de artes**, total **639**. Lint e tipagem passaram. A verificação específica do serviço foi repetida após acrescentar desconexão real: **34 testes passaram**.

Guia: [dinamite.md](../dinamite.md). A sequência completa e a final continuam nas próximas tarefas; D04 permanece pendente, sem alterar `PENDING_DECISIONS` ou `decisoes.md`.

Em 19/10/2026, `pnpm test:e2e` verificou o catálogo privado, compilou os pacotes e executou **10 percursos em 12,7 minutos**, todos aprovados e sem retry. Foram clássico, velocidade, aposta, roubo e dinamite em desktop **1280×900** e celular emulado **360×780**. A dinamite confirmou ordem inversa, quatro perguntas inéditas, prazo completo, dono exclusivo, recarga, acerto/erro/timeout, explosão e retorno ao lobby; terminou em **150/150**, com **1/1 acertos**. As duas capturas `dinamite-explosao.png` foram inspecionadas e mostraram dono, ciclo, explosão e próximo turno legíveis, sem transbordamento horizontal da página. O placar móvel conserva sua rolagem interna.

Após a revisão do texto de encerramento e desta documentação, o build e as verificações finais de formato e whitespace foram executados novamente. A CI hospedada permanece sem execução; os resultados acima são locais no Windows.

## Cuidados de implementação

Não transportar o cronômetro global de uma dinamite entre pessoas. Valores permanecem parametrizados e sujeitos ao equilíbrio de T32.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
