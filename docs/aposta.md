# Modalidade de aposta

A T19 registra `wagerStrategy` e acrescenta **Iniciar aposta de teste** ao lobby em desenvolvimento/teste. O protótipo usa seis perguntas aprovadas inéditas, com duas fáceis, duas médias e duas difíceis. Pontos, opções e tempos vêm da configuração experimental congelada por partida; D01 continua em consulta. Ainda não há sequência completa das cinco modalidades ou final.

## Escolha e liquidação

Antes de cada enunciado, o servidor abre `wager-selection` por **seis segundos**. Tema, dificuldade e placar estão visíveis. Cada participante recebe somente as opções cobertas pelo próprio saldo, dentre **0 / 25 / 50**. Um saldo de zero permite apostar zero e responder normalmente. Sem escolha até o prazo, a aposta daquela pergunta é zero.

A primeira escolha válida é selada com o saldo daquele momento; nenhum ponto é descontado na seleção. O prazo completo é mantido mesmo quando todos escolhem. A leitura do enunciado começa depois da etapa de aposta, seguida da abertura das alternativas e do prazo comum de resposta.

| Resultado | Efeito sobre o saldo anterior |
|---|---|
| Acerto | +100 de base e +valor apostado |
| Erro ou ausência de resposta | −valor apostado |
| Aposta zero | Acerto recebe a base; erro/ausência não reduz o saldo |

Com saldo 500 e aposta 50, o acerto termina em **650** e o erro/ausência em **450**. Velocidade de resposta não altera a pontuação. `sealWager`, `allowedWagerAmounts` e `resolveQuestion` da T13 são reutilizados; a estratégia recebe as apostas privadas aceitas e o motor confirma uma única resolução junto ao histórico e placar.

## Comandos, privacidade e reconexão

`match:start` aceita `mode: "wager"`, além de clássico e velocidade. A escolha é congelada no elenco. O seletor usa `wager-prototype`, com demanda própria e sem reserva da final. O protótipo começa em zero pontos; os primeiros acertos formam o saldo para apostas das próximas perguntas. Não há opção pública de injetar saldo.

`wager:submit` recebe somente contexto (`roomId`, `matchId`, `roundId`, `questionId`) e `amount`. Sessão, conexão atual, associação, papel, pergunta, fase, prazo, opção e saldo são verificados na fila da sala. Valor acima do saldo produz `INSUFFICIENT_BALANCE`; valor fora das opções, `INVALID_PAYLOAD`. Repetir a mesma aposta antes do prazo é um no-op, mesmo com outro `actionId`; tentar alterar uma aposta aceita produz `ACTION_CONFLICT`. Envio no prazo exato é recusado. Repetição após a etapa não reaplica efeito.

`MatchView.wagerRules` informa base e duração experimental da seleção. Durante `wager-selection`, cada visão inclui `ownWager` e `allowedAmounts` próprios, sem enunciado, alternativas ou apostas dos adversários. Leitura/resposta conservam somente `ownWager`; ausência de escolha aparece como zero. Espectadores recebem `unavailable`. `pointsAtSelection`, lista privada de apostas e recibos nunca são enviados.

Somente em `reveal`, `wagerResults` publica aposta e saldos anterior/atual por participante, junto aos efeitos oficiais. Os schemas conferem participantes únicos, cobertura do saldo e correspondência com o placar. O catálogo e os gabaritos continuam privados antes da revelação.

A nova conexão recupera a aposta aceita e os prazos originais. O cliente bloqueia uma escolha enquanto envia, depois do ack ou após confirmação incerta; não reaposta automaticamente. Uma nova fotografia autenticada reconcilia o estado. A UI usa saldo e opções recebidos, apresenta controles nativos por teclado/toque e mostra **Aposta 50 · Saldo 500 → 650** na revelação, além do efeito identificado no placar.

## Verificação

`wager.domain.test.ts` cobre saldo 0/25/50, valor não oferecido/insuficiente, ator/contexto/fase/prazo inválidos, repetição, conflito, privacidade e os exemplos 500→650/450, incluindo ausência de aposta/resposta. Os testes de serviço percorrem seleção e seis perguntas reais do seletor, concorrência, reconexão, prazo exato e saldo zero, com **850/0** no cenário controlado.

Os testes Socket.IO exercitam WebSocket e polling com sessões reais, espectador, acesso de outra identidade, campos privados injetados, reconexão e apostas diferentes no mesmo enunciado. O exemplo de rede termina a segunda pergunta em **250/75**, sem desconto antecipado. Testes web cobrem início, teclado, opções/saldo, confirmação, recuperação, privacidade e revelação de ganhos/perdas.

`wager-smoke.spec.ts` exercita seis perguntas com duas identidades em desktop e celular emulado. O roteiro inclui aposta zero, 25 e 50, ausência de aposta/resposta, recarga após escolher, efeitos e retorno ao lobby; o resultado esperado é **425/325**. As evidências de execução ficam na [T19](tasks/T19-fase-aposta.md).
