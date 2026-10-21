# Protocolo público — versão 1

Os schemas e tipos deste protocolo estão implementados em `packages/shared/src/`, exportados por `@penshow/shared`. Socket.IO, `time:sync`, as [sessões de convidado](sessoes.md) e os seis comandos `room:*` estão disponíveis. A [T15](quiz-classico.md) conecta `match:start`, `round:ready`, `category:choose`, `answer:submit` e `match:returnToLobby` ao protótipo clássico somente em desenvolvimento/teste. HTTP executa saúde, criação, verificação e renovação de sessão.

Os contratos não dependem de Socket.IO, Fastify, React ou Node. O transporte Socket.IO usa `/penshow/socket.io` no mesmo servidor HTTP, confere a origem e valida os envelopes. A configuração e o ciclo de vida estão em [servidor](servidor.md). Comandos de negócio exigem sessão válida e conexão ativa; `time:sync` permanece uma consulta pública.

## Envelope e identidade

Todos os comandos seguem esta estrutura:

```json
{
  "protocolVersion": 1,
  "actionId": "70498a35-559b-4e7c-a25c-28e8a4d657d0",
  "event": "answer:submit",
  "payload": {
    "roomId": "f4b21dc0-d3c3-46fd-9633-73a2c99581c9",
    "matchId": "e539329c-6a44-4ca4-8a36-04835e27e120",
    "roundId": "7657b6a6-876f-4991-8f5d-25ddbd394396",
    "questionId": "c044f8b2-62f9-4934-a5f0-be7c2b633ada",
    "optionId": "96b51d3b-4e3c-4cf7-9ef0-da1c98efbb76"
  }
}
```

`clientCommandSchema` discrimina pelo campo `event`. Todos os objetos são estritos: campos desconhecidos, campos de outro evento, versões desconhecidas e eventos desconhecidos são rejeitados. Se o adaptador receber o envelope em um evento nomeado de socket, deverá conferir que o nome externo corresponde a `event`.

Os IDs são UUIDv4; a tipagem distingue `PlayerId`, `RoomId`, `MatchId`, `RoundId`, `QuestionId`, `OptionId` e `ActionId`. O ator é obtido da sessão autenticada no servidor. Comandos não recebem `playerId` do autor, token, papel, pontos, acerto ou instante de recebimento. `targetPlayerId` identifica apenas o alvo de uma ação.

O código de convite tem seis caracteres do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, em maiúsculas. Não identifica nem autentica um jogador. O handshake autenticado recebe somente `auth: { token }`, conforme [sessões](sessoes.md); consulta anônima usa `{}`. Tokens e seus hashes não pertencem a comandos de jogo ou visões de sala.

## Comandos disponíveis como contrato

Em todas as linhas, `protocolVersion`, `actionId` e `event` ficam no envelope, e os campos listados ficam em `payload`.

| Evento | Payload | Validação contextual |
|---|---|---|
| `room:create` | `profile`, `settings` | Sessão, limite de criação, disponibilidade de conteúdo |
| `room:join` | `code`, `profile` | Sala existente, capacidade, reconexão e papel |
| `room:leave` | `roomId` | Associação à sala e política de saída durante partida |
| `room:updateProfile` | `roomId`, `profile` | Membro no lobby; perfil da partida permanece congelado |
| `room:updateSettings` | `roomId`, `settings` | Anfitrião no lobby; estoque de perguntas |
| `room:kick` | `roomId`, `targetPlayerId` | Anfitrião, alvo da mesma sala, somente lobby |
| `match:start` | `roomId`, `mode?` (`classic`, `speed`, `wager`, `theft` ou `pressure`) | Anfitrião, lobby, participantes e catálogo suficiente; ausência mantém clássico |
| `final:start` | `roomId`, `matchId` | Anfitrião, protótipo concluído, classificação pronta e estoque suficiente; não recebe vidas/políticas |
| `round:ready` | `roomId`, `matchId`, `roundId` | Participante nas instruções daquela fase |
| `category:choose` | `roomId`, `matchId`, `roundId`, `category` | Responsável pela vez, tema oferecido, prazo |
| `answer:submit` | `roomId`, `matchId`, `roundId`, `questionId`, `optionId` | Participante apto, pergunta e alternativa atuais, prazo e oportunidade |
| `wager:submit` | `roomId`, `matchId`, `roundId`, `questionId`, `amount` | Fase de aposta, valor oferecido, saldo e envio único |
| `target:choose` | `roomId`, `matchId`, `roundId`, `questionId`, `targetPlayerId` | Direito de escolher, adversário elegível, prazo e efeito único |
| `match:returnToLobby` | `roomId`, `matchId` | Anfitrião e estado que permite retorno/revanche |
| `time:sync` | `clientSentAt` | Consulta informativa; nunca determina prioridade |

`round:ready` explicita a ação de pronto prevista nas instruções do plano. Ações de partida levam contexto até o nível necessário: a aposta já informa `questionId` sem liberar seu enunciado; a revanche informa `matchId`, sem uma fase/pergunta corrente.

A [T18](velocidade.md) habilita também o protótipo isolado de velocidade em desenvolvimento/teste, reutilizando os comandos do clássico. Sua projeção inclui `MatchView.speedRules` com base, prazo e faixas de bônus congelados no servidor; esses valores não são enviados pelo cliente. Os schemas de regra são estritos, validam a ordem/cobertura das faixas e exigem esse campo nas etapas de velocidade. A versão 1 continua em desenvolvimento, com os consumidores do monorepo atualizados juntos.

A [T19](aposta.md) habilita `mode: "wager"` e o handler `wager:submit` em desenvolvimento/teste. `MatchView.wagerRules` informa base e prazo da seleção. O subestado de aposta publica tema/dificuldade, `allowedAmounts` cobertos pelo saldo do destinatário e `ownWager`, sem enunciado. Leitura/resposta conservam somente `ownWager`. A revelação publica `wagerResults` com valor e saldos anterior/atual, validados contra os participantes e placar. Lista privada de apostas e `pointsAtSelection` nunca saem do servidor. Repetição da mesma escolha aceita é no-op; alteração é `ACTION_CONFLICT`; escolha acima do saldo é `INSUFFICIENT_BALANCE`.

A [T20](roubo.md) conecta `mode: "theft"` e `target:choose` ao protótipo do primeiro acerto, mantendo D05 em consulta. Na modalidade de roubo, o handler aceita alvo em `theft-target-selection`, pelo autor autorizado, entre adversários com saldo depois dos créditos. `MatchView.theftRules` informa política e parâmetros experimentais. O autor do roubo nunca aparece em `question-open`. `reveal.theftResult` publica autor/alvo/valor e decomposição dos saldos, validada contra o placar e a transferência. Reenvio depois de liquidar não transfere novamente. A T23 acrescenta o contexto separado de ataque a vidas.

A [T21](dinamite.md) conecta `mode: "pressure"` ao protótipo de dinamite, mantendo D04 em consulta. `pressureRules` publica valores experimentais e dificuldades por ciclo. `pressureTurn` informa dono, ciclo, progresso e próximo jogador somente em leitura/resposta/revelação; `outcome` aparece apenas na revelação. O schema exige correspondência com o respondente exclusivo, a janela de resposta, a dificuldade e os efeitos do dono. `answer:submit` continua com o mesmo payload, autorizado somente ao dono. A ordem completa sorteada permanece privada; a reconexão recupera o turno e prazo originais.

A [T22](classificacao-e-vidas.md) acrescenta `MatchView.finalEntry` ao encerramento dos protótipos, sem novo comando. O escopo `isolated-prototype` distingue o resumo de uma entrada real na final. `ready` publica classificação e atribuições de vidas/perdas suportadas; `pending-tiebreak` publica placar, grupos e necessidade de decisão D06, sem vidas atribuídas. Os schemas validam evidências, distribuição confirmada, identidade, placar e fase. Reconexão e entrada de espectador recuperam o mesmo resumo. O transporte não oferece comando para escolher política ou informar ordem de desempate.

A [T23](final-no-servidor.md) conecta `final:start`, `round:ready`, `answer:submit` e `target:choose` à final de teste. O início cria um novo `roundId`, conserva `finalEntry` e suas vidas iniciais e publica `finalRules` com D02/D03 pendentes. Uma resposta válida confirma `first-valid` e fecha as tentativas; erro causa uma perda no autor e acerto concede somente a ele a escolha de alvo ativo. As projeções publicam vidas atuais, eliminação e uma resolução por pergunta. Na final, `progress.questionCount` é `null`, sem limite fixo de perguntas. `final-no-answer-pending` e `final-no-target-pending` suspendem sem fallback/dano; o anfitrião pode encerrar esse teste voltando ao lobby. O escopo continua de protótipo isolado, sem a sequência completa ou as telas da T24.

Os schemas verificam a estrutura e a pertinência das peças de avatar à própria categoria no catálogo público. Autorização, pertinência de IDs ao estado atual e concorrência pertencem aos serviços. Prazo de jogo, catálogo de perguntas e saldo ainda exigem o motor. Um UUID válido de outra sala não concede acesso. O schema de aposta admite inteiros não negativos; o serviço deve validar a lista de valores permitidos pela configuração congelada. Os valores experimentais 0/25/50 não viraram um limite permanente do protocolo.

Nos seis comandos `room:*`, associação, capacidade, papel e permissões do lobby são verificadas pelo serviço. A sessão e a conexão atual são conferidas novamente dentro da fila, imediatamente antes da mutação; uma ação que aguardou enquanto a sessão expirou ou outra aba assumiu é rejeitada. As modalidades instaladas revalidam conexão/papel/contexto/prazo na mesma fila e verificam conteúdo antes do início. `match:returnToLobby` público exige conclusão, interrupção ou suspensão explícita do protótipo final por D02/D03. `target:choose` opera roubo de pontos ou ataque a vidas conforme o contexto; em produção todos os comandos de partida permanecem indisponíveis. A [T28](privacidade-limites-e-concorrencia.md) limita frequência e comandos pendentes antes do serviço; isso inclui `time:sync`, eventos inválidos e sem callback. Trocar de conexão não restaura o orçamento da identidade.

`RATE_LIMITED` informa que o comando excedeu o orçamento ou as pendências permitidas e não foi executado. O cliente pode tentar manualmente após aguardar, se o prazo/contexto ainda permitir. `SERVER_BUSY` informa capacidade esgotada ao criar sala/sessão. Ambos usam o envelope público de erro, sem detalhes internos; as respostas HTTP correspondentes são 429 (com `Retry-After`) e 503. A versão do protocolo permanece 1 com a ampliação do catálogo de erros compartilhado.

## Confirmações e erros

`acknowledgementSchema` distingue `status: "ok"` de `status: "error"`. Sucessos são também discriminados pelo evento e têm resultado próprio:

| Eventos | `result` |
|---|---|
| `room:create`, `room:join` | `roomId`, `code`, `playerId`, `stateVersion` |
| `room:leave` | Objeto vazio |
| `match:start` | `matchId`, `stateVersion` |
| `answer:submit` | `stateVersion`, `acceptance` (`recorded` ou `first-valid`) |
| `time:sync` | `clientSentAt`, `serverReceivedAt`, `serverSentAt` |
| Demais mutações | `stateVersion` |

Exemplo de confirmação da primeira resposta aceita:

```json
{
  "protocolVersion": 1,
  "actionId": "70498a35-559b-4e7c-a25c-28e8a4d657d0",
  "status": "ok",
  "event": "answer:submit",
  "result": { "stateVersion": 42, "acceptance": "first-valid" }
}
```

Essa confirmação não contém acerto, gabarito ou pontos. Na final, `first-valid` confirma somente a prioridade concedida pelo servidor; a avaliação sai no estado que fechou as tentativas. Nas fases de respostas simultâneas, `recorded` confirma o registro individual.

Uma falha não repete payload, evento desconhecido, stack ou detalhes internos:

```json
{
  "protocolVersion": 1,
  "actionId": "70498a35-559b-4e7c-a25c-28e8a4d657d0",
  "status": "error",
  "error": {
    "code": "QUESTION_CLOSED",
    "message": "Esta pergunta já foi encerrada."
  }
}
```

Quando não houver um `actionId` válido que possa ser recuperado, a falha usa `actionId: null`. `createDomainError` constrói mensagens públicas em pt-BR; `domainErrorSchema` rejeita uma mensagem que não corresponda ao código.

| Código | Mensagem pública |
|---|---|
| `INVALID_PAYLOAD` | Os dados enviados são inválidos. |
| `UNKNOWN_EVENT` | Esta ação não é reconhecida. |
| `UNAUTHENTICATED` | Sua sessão expirou. Entre novamente. |
| `FORBIDDEN` | Você não pode realizar esta ação. |
| `NOT_FOUND` | O recurso solicitado não foi encontrado. |
| `ROOM_NOT_FOUND` | A sala não foi encontrada. |
| `ROOM_FULL` | A sala está cheia. |
| `NOT_ENOUGH_PLAYERS` | São necessários pelo menos 2 jogadores conectados. |
| `NOT_A_MEMBER` | Você não participa desta sala. |
| `INVALID_PHASE` | Esta ação não está disponível neste momento. |
| `STALE_CONTEXT` | A partida mudou. Aguarde a atualização da sala. |
| `DEADLINE_EXPIRED` | O prazo desta ação terminou. |
| `ALREADY_ANSWERED` | Sua resposta já foi recebida. |
| `QUESTION_CLOSED` | Esta pergunta já foi encerrada. |
| `INVALID_TARGET` | Escolha um adversário disponível. |
| `INSUFFICIENT_BALANCE` | Você não tem pontos suficientes para esta aposta. |
| `INVALID_SETTINGS` | A configuração da sala é incompatível. |
| `INSUFFICIENT_QUESTIONS` | Não há perguntas revisadas suficientes para esta partida. |
| `ACTION_CONFLICT` | Esta ação já foi usada com outros dados. |
| `RATE_LIMITED` | Muitas ações em pouco tempo. Aguarde e tente novamente. |
| `SERVER_BUSY` | O servidor está cheio. Aguarde e tente novamente. |
| `INTERNAL_ERROR` | Não foi possível concluir a ação. Tente novamente. |

Falhas de validação não enviam os objetos de erro do Zod ao navegador. O adaptador traduz a falha para o código apropriado; `UNKNOWN_EVENT` distingue nome desconhecido de payload inválido de evento conhecido. `NOT_FOUND` é usado em HTTP 404 sem repetir a URL recebida. Resultados dos handlers também são validados antes de sair.

## Visão completa e versões

Os eventos de saída contratados são:

```text
{ protocolVersion: 1, event: "room:view", payload: RoomView }
{ protocolVersion: 1, event: "room:removed", payload: { roomId, stateVersion, reason: "left" | "kicked" | "closed" } }
{ protocolVersion: 1, event: "session:ended", payload: { reason: "replaced" | "expired" } }
```

`room:view` publica uma fotografia completa do lobby por destinatário conectado, com `roomId`, `code`, `viewerId`, `stateVersion`, `serverNow`, `members` e `state`. O projetor escolhe explicitamente os campos públicos, incluindo `isHost` e presença, sem IDs de conexão, credenciais, banimentos ou timers internos. A publicação usa somente a conexão autenticada atual de cada membro. Uma nova conexão válida recupera a associação pelo `PlayerId` e recebe a fotografia completa, preservando perfil e vaga; não exige reenvio do código.

`room:removed` encerra a associação visível por saída, expulsão ou fechamento. Não encerra a sessão de convidado. Ao fechar a sala, esse é o único evento terminal de sala; não se envia uma visão final redundante. O cliente só remove sua visão se `roomId` corresponder e a versão não for anterior à atual. Entrega depende de conexão ativa; o encerramento do servidor aguarda o transporte esvaziar por até um segundo. Visões podem chegar antes do ack do comando que as causou.

`session:ended` é emitido antes de desconectar uma conexão substituída ou expirada e não contém credenciais. A partida contém `matchId`, `rulesVersion`, `progress`, placar e fase discriminada por `phase`; os formatos estão no [modelo de dados](modelo-de-dados.md). `progress` contém `roundNumber`, `roundCount`, `questionNumber` e `questionCount`. O protótipo da T15 publica uma fase e seis perguntas, terminando em `prototype-complete`, sem vencedor. Os schemas/consumidores da versão 1 em desenvolvimento foram atualizados juntos para o campo obrigatório; clientes estritos devem usar os contratos atuais.

- `protocolVersion: 1` identifica o formato dos envelopes. Alteração incompatível exige evolução explícita do protocolo.
- `stateVersion` é um inteiro seguro não negativo, crescente por sala a cada mutação publicada. Não reinicia na revanche. Fotografias diferentes para destinatários da mesma mutação compartilham a versão.
- O cliente compara versões somente dentro do mesmo `roomId`, ignora versões antigas/duplicadas e aplica uma fotografia completa ao reconectar. Um ack antigo não deve substituir uma visão mais recente.
- `matchId` é novo por partida/revanche; `roundId` é novo por ocorrência de fase; `questionId` é novo por apresentação, preservado entre leitura, abertura e resolução. Timers carregam esses IDs para rejeitar eventos antigos.
- `rulesVersion: "prototype-v1"` identifica o formato experimental. Pontos e tempos detalhados são definidos e congelados em T13, usados pelo motor da T14; esse identificador não declara D01–D06 aprovadas.
- `serverNow`, aberturas e prazos usam milissegundos Unix inteiros seguros. `time:sync` auxilia a exibição e ecoa o relógio local sem tratá-lo como autoridade. `serverSentAt` não pode anteceder `serverReceivedAt`.

Não se exige uma `stateVersion` enviada pelo cliente para responder: outras respostas podem aumentar a versão sem encerrar a pergunta. O serviço verifica os IDs, a fase, o prazo e o direito do ator no momento da execução.

## Aplicação única e primeira resposta da final

Identificação, autorização e serialização se aplicam às salas e aos protótipos. A T15 impede resposta/placar duplicados por participante/pergunta, mesmo com outro `actionId`, e a T23 protege a tentativa e o dano únicos da final, sem cache de ack por ação. A T28 aplica os limites de frequência antes do serviço. Replay do mesmo ack por `actionId` não está implementado; o cliente atual não repete mutações automaticamente. O domínio da T23 aplica as garantias da final abaixo:

1. Identificar e autorizar o ator antes de acessar o resultado de outra ação. Serializar comandos, presença e timers na mesma fila da sala.
2. Usar `actionId` por intenção lógica. O cache que devolverá o ack registrado para mesmo ator/ID/payload e recusará dados conflitantes continua nas tarefas de robustez. Hoje a fase e o contexto impedem repetir o efeito, sem garantir replay do mesmo ack.
3. Também deduplicar semanticamente por ator/pergunta/tipo de ação. Trocar `actionId` não concede outra resposta, aposta ou ataque.
4. Na final, validar ator ativo, contexto, alternativa e prazo antes de ocupar a oportunidade global da pergunta. Registrar a primeira resposta válida e fechar a pergunta dentro da fila, antes de avaliar o gabarito.
5. Uma primeira resposta errada custa uma vida ao autor. As demais são rejeitadas com `QUESTION_CLOSED`, sem avaliação ou dano. Uma correta permite apenas ao autor escolher qualquer adversário ainda ativo; a escolha retira uma vida, uma única vez.
6. Respostas inválidas, espectadores, eliminados e tentativas fora do prazo não ocupam a oportunidade. Ausência de conexão não torna um adversário com vida imune a ataque.

O schema representa uma única resposta aceita e dano literal 1; provar ordem de chegada, aplicação única e transições exige o motor e os testes de T14/T23/T26/T28. `time:sync` é uma consulta e não aplica efeito de jogo.

## Reconciliação e espera — T26

`room:sync` recebe payload vazio e consulta somente a associação da identidade autenticada atual. O resultado é `{ status: "present", roomId, stateVersion }` ou `{ status: "absent" }`. A presença é reconferida na fila, e uma associação existente publica uma fotografia atual com versão nova. Ator, sala e credenciais não são aceitos no payload da consulta. O ack não substitui o estado público recebido por `room:view`.

`MatchView.waitingForPlayers?: true` identifica espera depois de terminar uma janela sem conexões na sala. Conserva o estágio anterior e seu prazo vencido, bloqueia ações e não publica outra pergunta. No retorno, um timer executa somente o próximo passo pendente; respostas, apostas, placar e vidas já consumidos não voltam. O TTL absoluto não é renovado pela resolução ou por callbacks. D02/D03 conservam seus estados de regra pendente.

O cliente consulta a associação em cada conexão e aguarda fotografia nova. Resultado de ausência limpa o cache sem apagar perfil ou sessão válida, desde que não pertença a outra conexão nem tenha chegado outra sala entretanto. A maior versão por sala/identidade permanece conhecida depois da navegação. `connect_error` com erro de autenticação validado encerra a sessão; falha de transporte comum mantém identidade e ações bloqueadas. Consulte [cenários de reconexão](cenarios-de-reconexao.md).

## Resultados e revanche — T25

`MatchView.roundSummaries` é opcional e publicado somente em `prototype-complete`, `podium` ou `interrupted`. Cada item contém `round`, `status`, `questionsPlayed` e `players`; cada jogador traz `playerId`, `pointsBefore`, `pointsAfter`, `pointsDelta` e `correctAnswers` da fase. Os schemas verificam participantes únicos, delta coerente, acertos compatíveis com a quantidade de perguntas, continuidade de saldo e totais iguais ao placar encerrado. O campo omite perguntas, recibos, escolhas e checkpoint editorial. Os produtores e consumidores em desenvolvimento foram atualizados juntos; clientes estritos devem usar os contratos atuais.

`podium.standings` continua vindo exclusivamente do sobrevivente e da ordem inversa das eliminações. O histórico de pontos não reordena esse resultado. `match:returnToLobby` prepara a revanche pelo serviço e não inicia outra partida automaticamente. Preserva sala/perfis e fila privada de escolha de tema, libera quem saiu explicitamente e promove espectadores até a capacidade. A próxima partida ganha novos IDs; `stateVersion` da sala permanece crescente. Não há comando novo nem acesso do cliente à fila privada. Consulte [pódio e revanche](podio-e-revanche.md).

## Consultas e evolução

D01–D06 continuam em consulta em [decisões](decisoes.md). `PENDING_DECISIONS` registra esse estado sem selecionar políticas. As visões distinguem a quinta fase pendente da dinamite explicitamente experimental e a classificação pendente de desempate de uma classificação resolvida. Os schemas não têm defaults de duração, política de final sem resposta, alvo automático, variante de roubo ou desempate residual.

O núcleo contratado da resolução final contém erro e ataque manual. Resolução por ausência de resposta e fallback de alvo serão estendidos na tarefa afetada quando a política correspondente estiver definida; o contrato atual não promete que essas situações já são resolvidas. A presença de um formato experimental não muda o estado das consultas.
