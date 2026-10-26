# Dinamite por turnos

A T21 disponibiliza **Iniciar dinamite de teste** no lobby de desenvolvimento/teste. O plano isolado usa `pressureStrategy` e a variante `dynamite`. **D04 confirmada e aplicada em 23/10/2026:** dois turnos por participante e prazo individual completo. No modo clássico, a modalidade pode ocupar qualquer posição de 1 a 4 quando sorteada; a final ocupa a quinta. Os planos e as regras públicas padrão usam `confirmed`.

## Turnos e tempo

O servidor sorteia uma permutação dos participantes uma única vez, a partir dos IDs ordenados e da fonte aleatória injetada. O primeiro ciclo segue essa ordem; o segundo usa a ordem inversa. Cada participante recebe uma pergunta média e uma difícil, mesmo quando erra ou está temporariamente ausente. Acertos, pontos, anfitrião e ordem de respostas não alteram a escala. A ordem completa permanece privada.

Cada turno tem três segundos de leitura, dez segundos de resposta e três de revelação, seguidos de um segundo de transição. Somente o dono pode enviar a resposta. A primeira resposta válida encerra o turno; erro ou ausência causam explosão. O turno seguinte tem leitura própria e dez novos segundos, independentemente do tempo usado anteriormente. Timers atrasados preservam o intervalo anunciado; reconexão recupera o prazo original.

Acerto credita **300 pontos** e um acerto. Erro ou ausência debita **até 150**, limitado ao saldo. Saldo 50 perde somente 50; saldo zero continua zero. Explosão mantém o participante na partida, sem vidas ou eliminação. Dois acertos rendem no máximo 600 por pessoa. Todos os valores vêm dos parâmetros congelados da T13.

## Servidor e contrato

`match:start` aceita `mode: "pressure"`. O seletor `pressure-prototype` exige estoque de uma pergunta de cada dificuldade configurada por participante, sem repetição e sem reserva da final. O plano isolado tem índice de domínio 5 e progresso fase 1 de 1. Conteúdo insuficiente impede o início antes de alterar a sala.

`pressure-turns.domain.ts` determina dono, ciclo, dificuldade e próximo jogador pela permutação congelada e pelo histórico confirmado. A estratégia recebe o dono explicitamente e delega os pontos ao domínio de pontuação. Somente ele pode gerar recibo. Resolução e avanço acontecem na fila da sala; comandos repetidos e timers antigos não duplicam pontos, penalidades ou turnos.

`MatchView.pressureRules` publica base, penalidade, prazo e dificuldades com `status: "confirmed"`. A projeção deriva o marcador das regras congeladas; o schema rejeita divergência com a variante da fase. A política `prototype` permanece disponível somente para configurações de experimento. Durante leitura, resposta e revelação, `pressureTurn` publica dono, ciclo, número e total dos turnos, dificuldade e próximo jogador (ou `null` no último turno). Somente a revelação inclui `outcome: "passed" | "exploded"`. O schema confere participantes, progresso, ciclos, dificuldade, respondente exclusivo, janela de resposta e efeitos do dono.

Na resposta, `respondents` é `single-player`; somente o dono recebe `ownAnswer: pending`. Outros participantes e espectadores recebem `unavailable`. O gabarito e a explicação aparecem exclusivamente na revelação; recibos e ordem completa nunca integram as visões públicas. A interface usa os componentes comuns, mostra pavio individual, dono/ciclo, passagem ou explosão e próximo turno, e renderiza o saldo recebido. Resposta incerta permanece bloqueada até recuperar o estado.

## Conteúdo e verificação

O catálogo publicado atual tem 336 perguntas aprovadas. O estoque para o plano completo é verificado antes de iniciar a sala, incluindo até 12 jogadores. O serviço conserva também os testes com catálogo sintético; navegador, rede e piloto mecânico exercitam o catálogo real, com seu snapshot histórico identificado no piloto. A expansão para 5.000 segue em T33.

Domínio e serviço cobrem saldo 50, zero, +300, limite exato do prazo, callback atrasado, ator fora do turno, duplicidade, timer antigo, ausência e distribuição de 2/4/12 participantes. Socket.IO exercita WebSocket/polling, espectadores, campo de identidade injetado e substituição de conexão com prazo preservado. Web cobre instruções, dono, ciclo, teclado, bloqueios, confirmação incerta e efeitos recebidos.

`pressure-smoke.spec.ts` percorre quatro turnos em duas sessões e verifica ordem inversa, dificuldades, exclusividade, recarga, dois acertos, um timeout, um erro, explosão e retorno ao lobby. O resultado esperado é **150/150**, com um acerto por pessoa. As evidências executadas são registradas na [T21](tasks/T21-quinta-fase-pressao.md).
