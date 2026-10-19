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
| `match:start` | `roomId` | Anfitrião, lobby, participantes e catálogo suficiente |
| `round:ready` | `roomId`, `matchId`, `roundId` | Participante nas instruções daquela fase |
| `category:choose` | `roomId`, `matchId`, `roundId`, `category` | Responsável pela vez, tema oferecido, prazo |
| `answer:submit` | `roomId`, `matchId`, `roundId`, `questionId`, `optionId` | Participante apto, pergunta e alternativa atuais, prazo e oportunidade |
| `wager:submit` | `roomId`, `matchId`, `roundId`, `questionId`, `amount` | Fase de aposta, valor oferecido, saldo e envio único |
| `target:choose` | `roomId`, `matchId`, `roundId`, `questionId`, `targetPlayerId` | Direito de escolher, adversário elegível, prazo e efeito único |
| `match:returnToLobby` | `roomId`, `matchId` | Anfitrião e estado que permite retorno/revanche |
| `time:sync` | `clientSentAt` | Consulta informativa; nunca determina prioridade |

`round:ready` explicita a ação de pronto prevista nas instruções do plano. Ações de partida levam contexto até o nível necessário: a aposta já informa `questionId` sem liberar seu enunciado; a revanche informa `matchId`, sem uma fase/pergunta corrente.

Os schemas verificam a estrutura e a pertinência das peças de avatar à própria categoria no catálogo público. Autorização, pertinência de IDs ao estado atual e concorrência pertencem aos serviços. Prazo de jogo, catálogo de perguntas e saldo ainda exigem o motor. Um UUID válido de outra sala não concede acesso. O schema de aposta admite inteiros não negativos; o serviço deve validar a lista de valores permitidos pela configuração congelada. Os valores experimentais 0/25/50 não viraram um limite permanente do protocolo.

Nos seis comandos `room:*`, associação, capacidade, papel e permissões do lobby são verificadas pelo serviço. A sessão e a conexão atual são conferidas novamente dentro da fila, imediatamente antes da mutação; uma ação que aguardou enquanto a sessão expirou ou outra aba assumiu é rejeitada. O quiz clássico revalida conexão/papel/contexto/prazo na mesma fila e verifica conteúdo antes do início. `match:returnToLobby` público exige conclusão ou interrupção. `wager:submit` e `target:choose` continuam sem handler; em produção todos os comandos de partida permanecem indisponíveis. Limites de frequência continuam nas tarefas de robustez.

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

Identificação, autorização e serialização se aplicam às salas e ao quiz clássico. A T15 impede resposta/placar duplicados por participante/pergunta, mesmo com outro `actionId`, mas não guarda um cache de ack por ação. Registro/deduplicação de `actionId` e limites de frequência continuam nas tarefas de robustez; o cliente atual não repete mutações automaticamente. As garantias da final abaixo ainda exigem seu domínio próprio:

1. Identificar e autorizar o ator antes de acessar o resultado de outra ação. Serializar comandos, presença e timers na mesma fila da sala.
2. Usar `actionId` por intenção lógica. Reenvio com o mesmo ator/ID/payload devolve o resultado já registrado; o mesmo ID com outros dados produz `ACTION_CONFLICT`.
3. Também deduplicar semanticamente por ator/pergunta/tipo de ação. Trocar `actionId` não concede outra resposta, aposta ou ataque.
4. Na final, validar ator ativo, contexto, alternativa e prazo antes de ocupar a oportunidade global da pergunta. Registrar a primeira resposta válida e fechar a pergunta dentro da fila, antes de avaliar o gabarito.
5. Uma primeira resposta errada custa uma vida ao autor. As demais são rejeitadas com `QUESTION_CLOSED`, sem avaliação ou dano. Uma correta permite apenas ao autor escolher qualquer adversário ainda ativo; a escolha retira uma vida, uma única vez.
6. Respostas inválidas, espectadores, eliminados e tentativas fora do prazo não ocupam a oportunidade. Ausência de conexão não torna um adversário com vida imune a ataque.

O schema representa uma única resposta aceita e dano literal 1; provar ordem de chegada, aplicação única e transições exige o motor e os testes de T14/T23/T26/T28. `time:sync` é uma consulta e não aplica efeito de jogo.

## Consultas e evolução

D01–D06 continuam em consulta em [decisões](decisoes.md). `PENDING_DECISIONS` registra esse estado sem selecionar políticas. As visões distinguem a quinta fase pendente da dinamite explicitamente experimental e a classificação pendente de desempate de uma classificação resolvida. Os schemas não têm defaults de duração, política de final sem resposta, alvo automático, variante de roubo ou desempate residual.

O núcleo contratado da resolução final contém erro e ataque manual. Resolução por ausência de resposta e fallback de alvo serão estendidos na tarefa afetada quando a política correspondente estiver definida; o contrato atual não promete que essas situações já são resolvidas. A presença de um formato experimental não muda o estado das consultas.
