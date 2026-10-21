# Modalidade de velocidade

A T18 registra `speedStrategy` no motor comum e permite iniciar **Velocidade de teste** pelo lobby, somente em desenvolvimento/teste. É uma fase isolada de seis perguntas: duas fáceis, três médias e uma difícil, retiradas do catálogo privado aprovado, sem repetição. O clássico continua disponível pelo botão existente. Ainda não há sequência completa das cinco fases, final ou pódio.

## Pontos e tempo

As regras são os parâmetros experimentais congelados da T13. D01 continua em consulta; esta implementação não confirma duração ou equilíbrio do produto.

| Recebimento após abertura | Acerto: base | Bônus | Total |
|---|---|---|---|
| De 0 até antes de 5 s | 100 | 50 | 150 |
| De 5 até antes de 10 s | 100 | 25 | 125 |
| De 10 até antes de 15 s | 100 | 0 | 100 |
| Exatamente 15 s ou depois | Resposta recusada | — | — |

Erro ou ausência vale zero. Dois jogadores na mesma faixa recebem o mesmo bônus quando acertam; não existe prêmio por simplesmente responder primeiro. `receivedAt` é medido dentro da fila da sala pelo relógio do servidor. Horário local, sincronização de exibição e latência declarada pelo cliente não alteram o cálculo. Campos extras como `receivedAt` são recusados pelo contrato estrito.

`speedStrategy` delega ao cálculo puro `resolveQuestion` existente, com `mode: speed`. A estratégia compartilha leitura, respostas, revelação, histórico, timers, serialização e projeção do clássico. Todos responderem encerra a pergunta antecipadamente; caso contrário, o timer fecha no prazo. Respostas repetidas não reaplicam efeitos.

## Início, conteúdo e contrato público

`match:start` recebe `payload: { roomId, mode?: "classic" | "speed" }`. Ausência de `mode` mantém o clássico. Autenticação, anfitrião, lobby, mínimo de dois conectados e conteúdo suficiente são verificados pelo servidor. O modo é copiado no elenco congelado (`QuizRoster.prototypeMode`) e não pode mudar depois do início. Em produção, nenhum dos dois protótipos instala handlers.

O seletor recebeu `speed-prototype`, com a demanda própria da velocidade e sem reserva da final. A falta de pergunta difícil bloqueia o início antes da mutação da sala. O lote de 72 perguntas permite essa fase isolada; a cobertura ampla continua em T27. O índice de domínio da velocidade é 2, enquanto `progress` mostra fase 1 de 1 no plano isolado.

`MatchView.speedRules` publica somente `correctPoints`, `responseMs` e `bonusBands: { beforeMs, points }[]`, copiados das regras daquela partida. As faixas precisam crescer no tempo, não aumentar o bônus e terminar em `responseMs`; o schema exige as regras quando a fase é de velocidade. Objetos continuam estritos. Nenhum checkpoint, recibo, pergunta futura, fonte editorial ou gabarito antecipado é acrescentado.

## Interface e reconexão

Clássico e velocidade usam `CommonRound`, com a mesma tela de leitura, pergunta, seleção definitiva e revelação. `SpeedRules` apresenta os valores recebidos do servidor, com a origem do tempo e as faixas inclusivas no início/exclusivas no fim. A revelação detalha base, bônus e total por participante a partir dos efeitos confirmados; o placar identifica o bônus de velocidade. O navegador não avalia alternativas nem atribui pontos por tempo local.

Depois de responder, a nova conexão recebe `ownAnswer: submitted` e a alternativa original bloqueada. Reconexão não renova o prazo nem a pontuação. Na conclusão, o anfitrião retorna o grupo ao lobby pelo mesmo comando existente.

## Verificação

Os testes de serviço cobrem 4.999, 5.000, 9.999, 10.000, 14.999 e 15.000 ms, duas respostas na mesma faixa, erro em dois segundos, ausência, reconexão e seis perguntas distintas com a mistura própria. Alterar os parâmetros de origem depois do início não modifica a partida. Há bloqueio por falta de pergunta difícil.

Os testes Socket.IO exercitam WebSocket e polling, recusam relógio injetado, substituem a conexão após resposta e verificam prazo, resposta definitiva e efeitos oficiais de 125 pontos para os dois jogadores. A auditoria confere privacidade. Os testes web usam base/bônus/faixas diferentes dos padrões para verificar que a tela consome os parâmetros publicados. `e2e/tests/speed-smoke.spec.ts` cobre as seis perguntas em duas identidades reais, recarga após resposta, placar, bônus, conclusão e retorno, em desktop e celular emulado. As evidências de execução ficam na [T18](tasks/T18-fase-velocidade.md).
