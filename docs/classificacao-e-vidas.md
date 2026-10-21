# Classificação e atribuição de vidas

A T22 acrescenta o domínio puro `modules/scoring/final-entry.domain.ts` e os contratos `FinalEntry` e `QualificationPolicy`. A distribuição confirmada é **5 / 4 / 3 / 2 vidas**, para sobreviver a **4 / 3 / 2 / 1 perdas**. Os pontos anteriores ficam como histórico; não são convertidos proporcionalmente nem usados como saldo de vidas.

**D06 continua em consulta.** O comportamento instalado compara somente pontos. Se os pontos não definem todas as colocações, informa os grupos empatados e `decision-required`, sem atribuir vidas. Comparação por acertos e desempate residual só existem como propostas explicitamente selecionadas na API interna do domínio. Nenhuma delas é ativada pelo anfitrião, pelo cliente ou por silêncio do usuário.

## Retrato de entrada

`prepareFinalEntry` valida o placar, copia seus valores e cria um retrato profundamente congelado, identificado por `matchId` e escopo. Uma chamada com retrato anterior da mesma partida e escopo devolve esse próprio retrato, mesmo que o placar recebido tenha mudado. Partida ou escopo diferente produz `stale-context`. Reconectar ou abrir uma tela não chama novamente a conversão.

Sem empates, a classificação recebe posições consecutivas e uma atribuição por participante:

| Posição | Vidas iniciais | Perdas suportadas | Perda que elimina |
|---|---:|---:|---:|
| 1ª | 5 | 4 | 5ª |
| 2ª | 4 | 3 | 4ª |
| 3ª | 3 | 2 | 3ª |
| 4ª em diante | 2 | 1 | 2ª |

Salas com duas ou três pessoas recebem apenas suas próprias posições. IDs servem para ordenar a apresentação dos grupos pendentes de forma determinística; não resolvem empates. O domínio não recebe anfitrião, socket, ordem de conexão ou Map de membros.

## Propostas de desempate isoladas

Uma política interna `{ status: "prototype", decisionId: "D06", secondary: "correct-answers", residual: "draw" | "extra-questions" }` permite testar as propostas. Acertos são comparados apenas entre participantes com os mesmos pontos e geram evidência dos grupos resultantes em `tieBreaks`. Se ainda há empate, o retrato informa `draw-required` ou `extra-questions-required`; não cria um vencedor automaticamente.

`resolveFinalTie` recebe um resultado explícito do servidor: partida e ordem completa de um grupo residual. Não lê relógio, sorteia números, seleciona perguntas ou acessa sockets. O futuro adaptador de sorteio/perguntas deverá produzir esse resultado quando a política estiver escolhida. A resolução conserva os pontos e os demais grupos; só atribui vidas depois de resolver todos os empates. Repetição do mesmo resultado devolve o retrato já existente; resultado conflitante é recusado. Grupo parcial, participante externo, duplicidade e partida incorreta também são recusados.

Perguntas extras estão representadas como necessidade e resultado, sem executar um quiz de desempate antes de D06. Vidas iguais não foram implementadas como regra: essa alternativa exige definir como compatibilizar as posições empatadas com a distribuição confirmada.

## Integração e projeção

Ao encerrar um plano isolado de teste, o motor prepara `MatchState.finalEntry` uma única vez, junto com `prototype-complete`. A projeção publica `MatchView.finalEntry` com `scope: "isolated-prototype"`. Esse resumo exercita a conversão com o placar daquele protótipo; não inicia a final nem representa uma partida completa de cinco fases. A [T23](final-no-servidor.md) permite continuá-lo numa final de teste por `final:start`, conservando essa atribuição. A sequência completa continua para etapas posteriores; as telas de vidas pertencem à T24.

Um resumo `ready` contém classificação histórica e `allocations`, com vidas iniciais, perdas suportadas e perda eliminatória por jogador. Um resumo `pending-tiebreak` contém placar, grupos e próximo passo, sem `allocations`. O agregado da sala rejeita alterações de uma conversão pronta durante a mesma partida. Sair para o lobby e começar outra partida cria um novo contexto.

Os schemas são estritos e conferem identidade, participantes, posições, distribuição de vidas e evidências dos desempates. Eles reproduzem a sequência dos registros para impedir que uma ordem arbitrária seja apresentada como empate resolvido. A visão de partida só aceita o resumo no encerramento do protótipo, com o mesmo `matchId`, escopo e placar. Os pontos e acertos continuam históricos, sem efeitos de crédito/débito causados pela classificação.

## Verificação

O domínio cobre 2, 3, 4 e 12 participantes; vários empates; comparação experimental de acertos; sorteio e perguntas extras como resultados explícitos; repetição/conflito; placar inválido; imutabilidade profunda; saldo congelado e independência da ordem de arrays/Map. Os contratos recusam vidas incorretas, evidência incompleta, grupos vazios, classificação inventada e resumo fora de contexto.

O serviço cobre resumo pronto, pendência D06, reconexão, cópia externa do estado e tentativa de apagar uma conversão pronta. Socket.IO percorre seis perguntas com relógio de teste, publica o resumo, recupera a mesma atribuição numa conexão substituta e a entrega a espectadores em WebSocket e polling. Evidências executadas ficam na [T22](tasks/T22-classificacao-e-vidas.md).
