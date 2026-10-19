# Pontuação e parâmetros experimentais

A T13 implementa cálculos puros em `apps/server/src/modules/scoring/scoring.domain.ts` e configuração validada em `match-rules.ts`. As funções recebem fotografias do placar e recibos internos do servidor, retornando um novo resultado sem alterar a entrada. Não acessam rede, relógio global, sorteio, agendador ou banco.

Os valores são **experimentais**, conforme o [plano do jogo](plano-do-jogo.md). D01–D06 continuam em consulta. As regras confirmadas da final permanecem em `CONFIRMED_FINAL_RULES`, com 5/4/3/2 vidas, primeira resposta exclusiva e uma perda de vida por erro ou ataque. A T13 não executa final, desempate ou distribuição de vidas.

## Uma configuração por partida

`PROTOTYPE_PARAMETERS` concentra pontos, tempos, quantidades, dificuldades, apostas, limites de transferência e reserva. `prototypeParametersSchema` valida a estrutura completa. `freezeMatchRules(matchId, parameters?)` valida e copia os dados, congelando recursivamente objetos e arrays. Retorna `FrozenMatchRules` com identidade da partida, parâmetros experimentais, regras confirmadas e decisões pendentes em campos separados.

| Parâmetros padrão | Valor proposto |
|---|---|
| Instruções / escolha de tema / leitura | 15 s / 10 s / 3 s |
| Transição / resultado da fase | 1 s / 8 s |
| Perguntas de clássico / velocidade / aposta / roubo | Seis por fase, com a mistura de dificuldades do plano |
| Resposta nas quatro primeiras fases / revelação | 15 s / 4 s |
| Clássico | Acerto +100 |
| Velocidade | Acerto +100; bônus +50 antes de 5 s, +25 antes de 10 s, zero depois |
| Aposta | +100 por acerto; valores 0/25/50; janela de 6 s |
| Roubo | +100 por acerto; primeiro acerto transfere até 50; alvo em até 6 s |
| Dinamite | Um ciclo médio e um difícil por pessoa; +300 / até −150; resposta 10 s, revelação 3 s |
| Final, parâmetros experimentais de tempo/conteúdo | Reserva de 50; resposta 15 s, alvo 6 s, revelação 4 s |

Os campos de pontos são inteiros seguros não negativos e os tempos são inteiros seguros positivos. Demandas de conteúdo precisam somar ao menos uma pergunta, com até 100.000 por dificuldade; a reserva é par, entre dois e 100.000 itens, para alternar fácil/média. Apostas incluem zero em ordem crescente, sem duplicatas, com até 16 valores. Faixas de velocidade têm limites temporais crescentes, bônus não crescentes e terminam no prazo de resposta. Até quatro temas podem ser oferecidos, respeitando o contrato público. Esses são limites técnicos de validação, não metas de tamanho ou duração da partida.

As políticas experimentais de roubo e dinamite exigem explicitamente `status: "prototype"` e D05/D04. Não há opção para sobrescrever vidas confirmadas ou marcar decisões como aprovadas. D02/D03 continuam sem política automática de pular pergunta ou escolher alvo; o parâmetro de seis segundos não decide o que fazer depois dele.

Uma nova configuração não altera uma partida que já recebeu seu snapshot. Para experimentar outros valores, validar a cópia completa de parâmetros e chamar a fábrica para a nova partida. O [motor da T14](motor-de-partida.md) guarda esse resultado junto ao elenco/configuração e ao checkpoint privado da seleção.

## Reuso pela seleção

`QuestionSelection.create(..., { ..., rules })` recebe a mesma configuração congelada usada na pontuação. Quantidade por dificuldade, número/ordem dos ciclos da dinamite, prazo/opções de tema e tamanho da reserva são derivados desses parâmetros. `SELECTION_PROPOSAL` permanece como adaptação dos padrões, sem repetir números de orçamento.

O argumento anterior `categoryChoiceMs` continua disponível para o protótipo isolado. Com `rules` explícito, só pode coincidir com o prazo congelado; divergência ou configuração de outra partida é recusada. Testes alteram o clássico para duas perguntas de +175, a escolha para sete segundos e duas opções, verificando seleção e cálculo com os mesmos valores. Outro teste muda a reserva para dez e inverte os ciclos da dinamite, preservando os padrões das demais partidas.

## Cálculos e entrada autoritativa

| Função | Resultado |
|---|---|
| `createScoreboard(players)` | Placar de participantes únicos, começando em zero pontos/acertos |
| `credit` / `debit` | Nova entrada e `ScoreEffect`; débito limitado ao saldo disponível |
| `addCorrectAnswer` | Nova entrada com mais um acerto, sem alterar pontos |
| `transferPoints` | Novo placar e dois efeitos com o mesmo valor efetivo; conserva pontos da transferência |
| `allowedWagerAmounts` / `sealWager` | Valores cobertos e aposta selada com saldo original; nenhum desconto antecipado |
| `scoreboardChanges` | Pontos/acertos antes e depois e delta por identidade, sem classificar empates |
| `resolveQuestion` | Resultado de uma pergunta: placares, efeitos, acertos e variações |

`resolveQuestion(rules, scores, context, input)` recebe `matchId`, `roundId`, `questionId` e `opensAt`. Exige correspondência da partida. Nas fases simultâneas, `answers` contém apenas respostas aceitas: `{ playerId, correct, receivedAt }`, em ordem de recebimento pela fila do servidor. `correct` vem da avaliação do gabarito privado; `receivedAt` é do servidor. Nenhum desses dados é aceito do comando público do cliente.

Jogadores sem recibo estão ausentes. Recibos repetidos, de não participantes, com campos extras ou fora da ordem temporal são recusados. A abertura é inclusiva e o fim exclusivo: resposta em `opensAt + responseMs` já está fora. Overflow de tempo, pontos ou acertos causa falha sem devolver placar parcial nem alterar a entrada. Saldos e contadores continuam inteiros seguros não negativos.

### Clássico e velocidade

Acerto credita a base e incrementa o contador de acertos. Erro ou ausência não reduz o saldo. Na velocidade, somente acerto recebe a faixa correspondente ao tempo de chegada: 4.999 ms rende 150, 5.000 ms rende 125, 10.000 ms rende 100 e 15.000 ms é recusado. Tempo de rede não é compensado com hora fornecida pelo cliente.

### Aposta

`sealWager` exige valor oferecido e coberto pelo saldo. Guarda `pointsAtSelection`, sem movimentar pontos. A resolução exige que esse saldo continue igual ao saldo anterior à pergunta; não aceita um estado já descontado como se a aposta ainda estivesse por liquidar.

Acerto recebe a base mais a aposta; erro ou ausência recebe um único débito da aposta. Sem aposta selada, usa zero. A partir de 500 pontos, apostar 50 termina em 650 com acerto ou 450 com erro/ausência. Um participante sem saldo pode apostar zero e receber a base pelo acerto.

### Roubo

Todos os créditos de acerto são aplicados antes da transferência. O beneficiário é a primeira resposta correta na lista de recibos; uma errada anterior não bloqueia o direito. Empate no mesmo milissegundo conserva a ordem da lista, que deve vir da fila do servidor, sem usar posição no placar, anfitrião ou conexão para desempatar.

O alvo pode ser informado ou `null`. Sem escolha, permanece apenas a pontuação por acerto. Alvo próprio, desconhecido ou transferência sem nenhum acerto são recusados; alvo sem saldo transfere zero. A quantidade é limitada ao saldo do alvo após seus créditos. O caso de 30 pontos transfere 30, com débito e crédito iguais. A autorização de quem enviou a escolha será aplicada pelo serviço da modalidade.

### Dinamite

Somente `respondentId` recebe crédito, acerto ou penalidade. Seu recibo precisa ter a mesma identidade. Acerto recebe +300; erro ou ausência perde até 150. Com saldo 30, o efeito informa débito de 30 e saldo final zero. Agendar turnos, definir donos e criar novas janelas é responsabilidade da modalidade, não dessas funções.

## Histórico e revelação

`QuestionScoreResolution` guarda contexto, versão, modalidade, placares `before`/`after`, IDs que acertaram, efeitos e variações. São cópias separadas das entradas, sem gabarito ou alternativas editoriais. `ScoringHistory` associa a lista à configuração congelada e ao `matchId`, conservando os valores utilizados, inclusive quando o protótipo é ajustado.

`effects` usa o contrato público existente `ScoreEffect`, com motivo e valor efetivamente aplicado. Transferência tem débito e crédito; penalidade limitada informa o valor real. Efeitos zero são omitidos da resolução. O projetor da T14 inclui os efeitos da resolução clássica na revelação e o placar em `MatchView`; a futura tela exibirá os valores sem executar o cálculo oficial. Shared apenas ganhou aliases de tipos inferidos (`Scoreboard`, `ScoringRound` e `ScoringMode`), sem publicar funções de pontuação ou parâmetros privados.

O cálculo é puro: mesmas entradas produzem o mesmo resultado. Não controla estado de partida, fecha janelas ou deduplica comandos. **Aplicar e guardar cada resolução uma única vez**, autenticar o ator, confirmar fechamento e serializar efeitos são responsabilidades do motor/serviço; a T14 executa esse ciclo para a estratégia clássica, com testes de repetição e falhas. Recalcular contra um placar já atualizado não é mecanismo de reenvio idempotente.

## Evidências

Os testes compõem as cinco fases e obtêm ganhos individuais **600 / 900 / 900 / 900 / 600**, totalizando **3.900 pontos e 26 acertos**. No mesmo cenário, outro participante termina com 3.300 porque sofre as transferências do roubo: não se promete o máximo de roubo a todos simultaneamente.

Também reproduzem a trajetória do plano: **400 → 925 → 1.375 → 1.825 → 1.975**, com 17 acertos. Para cada resolução do exemplo máximo, a soma dos efeitos com sinal corresponde ao delta por participante, e placares/efeitos passam nos schemas públicos. Os demais testes cobrem imutabilidade, mudança de parâmetros, limites temporais, zero/overflow, apostas inválidas, alvo com 30, ausência e contexto incorreto. Execuções e integração compilada estão nas [evidências da T13](tasks/T13-pontuacao-e-parametros.md).
