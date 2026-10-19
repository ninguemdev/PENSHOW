# Domínio e serviço de salas

T07 implementa o serviço de salas, exposto internamente como `app.rooms`; T08 conecta os seis comandos `room:*` autenticados, presença, reconexão, remoção e projeções individuais. T09 entrega o fluxo visual de criar/entrar por código ou convite, preferências, perfil, saída e expulsão no lobby. A T14 acrescenta o [motor interno](motor-de-partida.md) e a [T15](quiz-classico.md) conecta seus comandos à rede somente em desenvolvimento/teste, com uma fase clássica. Não há novos endpoints HTTP.

O agregado/fila, geração de códigos e política de anfitrião foram adaptados do Comicle no commit `4521f34df78da7de54a30715d50e748c50aa0696`, com [atribuição e licença MIT](../THIRD_PARTY_NOTICES.md). Não há dependência de histórias, desenho, banco, React ou Socket.IO no módulo de salas.

## Agregado, registro e fila

`RoomRegistry` mantém mapas de salas por ID/código e uma reserva de sala por `PlayerId`. Uma identidade não pode criar/ocupar duas salas ao mesmo tempo, inclusive com entradas concorrentes em filas diferentes. Reservas de admissões que falham são liberadas sem apagar a associação de outra sala. IDs/códigos já registrados nunca são sobrescritos. Criação reserva código e identidade antes do primeiro await.

`Room.runExclusive` encadeia tarefas por sala. Cada tarefa recebe um rascunho isolado e chama `touch()` para publicar uma alteração; isso prepara exatamente a próxima `stateVersion`. Só tarefas bem-sucedidas aplicam o rascunho. Erros e invariantes quebradas rejeitam a tarefa, preservam o estado e liberam a fila. Snapshots, rascunhos já encerrados e dados do observador não permitem alterar o estado armazenado por referência.

Criação, entrada, perfil, configurações, presença, expulsão, transições de ciclo e encerramento passam pela fila. Callbacks de timer também entram nela e reconferem contexto **depois da espera**. Não há rollback de uma publicação já confirmada por falha de observador: a falha é reportada separadamente e não repete a mutação.

`stateVersion` começa em 1 na criação e cresce por commit, sem reiniciar na troca de partida. `phaseEpoch` identifica cada transição lobby/partida para invalidar callbacks antigos. O registro contém estado privado: `connectionId`, banimentos e informações de ciclo **não são enviados diretamente à web**. O publicador usa `buildPlayerView` para construir uma lista explícita dos campos públicos, validada por `RoomView`.

## Identidade e operações

`RoomActor` contém `playerId` e `connectionId`, fornecidos pela autenticação confiável, não pelo payload do jogador. O serviço reconfere associação e conexão dentro da fila. A composição conecta `isCurrentActor` a `ActiveConnections.isCurrent` e à existência de um socket conectado. Sessão expirada, conexão substituída ou desconectada não aplica um comando que ainda aguardava na fila. O serviço não aceita um apelido como identidade; mesmo chamadas diretas a `app.rooms` precisam de conexão autenticada quando usam essa composição.

| Operação | Comportamento |
|---|---|
| `create` | Valida perfil/settings, cria o anfitrião e registra a sala |
| `join` | Valida código, bloqueio e reserva; reconecta membro existente antes de conferir capacidade |
| `updateProfile` | Só o próprio membro conectado, somente no lobby; usa normalização e catálogo compartilhados |
| `updateSettings` | Só anfitrião conectado no lobby; não reduz o limite abaixo das vagas já ocupadas |
| `kick` | Só anfitrião no lobby, alvo diferente e existente; libera associação e bloqueia reentrada da mesma identidade nessa sala |
| `leave` | Remove no lobby; participante de partida conserva vaga e fica ausente; espectador sai imediatamente |
| `disconnect` | Ignora conexão antiga/substituída; marca a conexão atual ausente sem apagar identidade ou elenco |
| `reconnect` | Restaura a sala da identidade autenticada, sem código/perfil informado pelo cliente e sem ocupar outra vaga |
| `start` | Só anfitrião no lobby, com ao menos dois jogadores conectados e porta de quiz disponível |
| `returnToLobby` | Limite interno de ciclo: exige anfitrião e matchId atual, preserva versão e promove espectadores até a capacidade |
| `close` / `dispose` | Fecha, cancela timers, libera códigos/associações; dispose impede novas operações e aguarda filas |

Os IDs de sala/partida são UUIDv4. Convites têm seis caracteres do alfabeto público `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, sem caracteres ambíguos. A geração recebe RNG injetável, tenta novamente em colisão e falha após 20 tentativas, sem laço ilimitado ou sobrescrita. IDs, alfabeto e limites públicos usam `ROOM_LIMITS` em shared.

A capacidade configurada é de 2 a 12 jogadores; ausentes ainda ocupam vaga. Durante a partida, novas identidades entram como espectadores, até o limite total de 100 membros do contrato público; membro existente reconecta mesmo no limite. Banimento vale para a mesma sessão/PlayerId enquanto a sala existir, não promete impedir criação de uma identidade anônima nova.

## Presença e anfitrião

O criador é anfitrião. Em saída voluntária do anfitrião, o controle passa imediatamente ao jogador conectado mais antigo. Em queda, há carência antes da transferência. O retorno durante a carência cancela a troca. Empates de entrada preservam a ordem de inserção.

Se ninguém elegível estiver conectado, o anfitrião atual ou jogador mais antigo conserva a posição como pendente; o primeiro **jogador** que retornar recebe o controle. Espectadores não assumem a liderança da partida. Trocar de conexão para a mesma identidade não cria outro membro, não muda a ordem de entrada e faz comandos/disconnects antigos perderem efeito.

No lobby, ausência prolongada remove o membro e libera sua reserva. Na partida, os jogadores preservam a vaga e o perfil congelado; reconectar não aceita mudanças de perfil. No retorno ao lobby, ausentes recebem nova janela de remoção contada a partir do retorno, preservando o instante original da desconexão para presença. Jogadores excedentes não são removidos para acomodar espectadores.

## Política e timers

`DEFAULT_ROOM_POLICY` é configuração tipada e congelada, injetável por `AppDependencies.roomPolicy`. São **valores de protótipo**, não conclusão das consultas sobre timing do jogo:

| Campo | Padrão |
|---|---|
| `hostTransferGraceMs` | 30 segundos |
| `lobbyRemovalMs` | 120 segundos |
| `emptyRoomTtlMs` | 120 segundos |
| `maxAgeMs` | 12 horas desde a criação |

Prazos precisam ser inteiros positivos. O serviço usa apenas relógio/agendador injetados, sem `Date.now`/`setTimeout` no domínio. Timers são reconciliados após commits, com prazos absolutos baseados nos instantes de criação/ausência; outra alteração não prolonga a carência ou idade máxima.

Cada timer guarda identidade do objeto sala, chave, token de agendamento e epoch da fase. Cancelamento, reconexão, nova partida, encerramento e reutilização de código invalidam callbacks anteriores, inclusive os já entregues à fila. Fechar uma sala cancela apenas os seus timers. Fechar a aplicação chama `rooms.dispose()` antes de encerrar o agendador.

A saída do último membro fecha imediatamente com `no-players`. Ausência de todos os conectados por TTL ou idade máxima fecha com `expired`; desligamento usa `server-shutdown`. Não é declarado vencedor. A política de pausa/resolução de janela de jogo e reconexão em cada fase pertence a T14/T26; o roster de T07 não simula essas fases.

## Limite com o quiz

`QuizLifecycle.validateStart` é uma porta síncrona de validação/preparação. Recebe cópia do `QuizRoster`: ID da partida, instante, configurações e lista de jogadores/perfis congelados, incluindo vagas reservadas de ausentes. Falha de preparação não muda o lobby. Ela não pode alterar o elenco armazenado por referência.

A T14 permite retornar um `MatchSession` preparado por `validateStart`, confirmado no mesmo início de sala. O hook `committed` cancela/agenda o timer de partida antes da publicação. Elenco, configuração e plano continuam imutáveis na mesma partida. A T15 injeta `MatchService` e o seletor efetivo em desenvolvimento/teste; produção continua sem essa porta porque o modo atual é um protótipo de uma fase. Validadores antigos podem retornar `void`. O retorno interno permite cancelamento; o handler público fixa `requireFinished: true`, verificado na fila, aceitando apenas conclusão ou interrupção. Revanche completa/histórico pertencem à T25.

## Verificação

`room.service.test.ts` usa relógio manual, RNG e dependências controladas: colisões, capacidade/reconexão, última vaga concorrente, associação entre salas, rollback e continuidade da fila, autenticação na execução, expulsão, carência/transferência, elenco congelado, espectadores, callbacks atrasados e limpeza. `app.test.ts` recusa ator sem conexão autenticada; os testes de rede verificam criação e fechamento com o serviço composto.

`room.realtime.test.ts` usa servidor e clientes Socket.IO reais em portas efêmeras, em polling e WebSocket. Verifica as seis ações, visões por destinatário, bloqueio entre salas, reconexão sem `room:join`, troca de aba e expiração durante espera na fila. Não usa sleeps, rede externa ou banco.

## Publicação e remoção em tempo real

Os handlers em `room.handlers.ts` recebem o PlayerId validado pelo dispatcher e capturam o ID da conexão no servidor. Delegam as regras ao serviço; o dispatcher valida entrada e confirmação pelo evento correspondente. `AppDependencies.handlers` continua permitindo sobrepor handlers em testes; a composição padrão registra as seis ações reais de sala.

O observador de commit recebe snapshots anterior/atual. Para cada membro conectado e ainda autenticado, `room-publisher.ts` produz uma fotografia completa com `viewerId` próprio, mesma versão/instante para todos os destinatários daquela mutação. Nome/avatar, papel, `isHost`, presença e settings são copiados explicitamente, inclusive objetos aninhados. Não se usam broadcasts por código que possam incluir conexões removidas. O snapshot privado, socket, credenciais, banimentos e perguntas futuras não atravessam a projeção.

Entrada, perfil, settings, queda, reconexão e transferência de anfitrião publicam nova fotografia. Reconexão parte do vínculo PlayerId/sala já registrado; a criação provisória sem commit não é restaurada. Uma aba substituída recebe `session:ended`; sua desconexão não publica uma queda falsa nem apaga a conexão nova. Queda real/expiração marca ausência pela fila.

Saída/expulsão envia `room:removed` ao membro removido, com `roomId`, `stateVersion` e razão `left`/`kicked`. Os restantes recebem a nova fotografia; o removido não a recebe. Fechamento usa somente o evento terminal `room:removed` com `closed`, antes de liberar transportes. Ele não invalida a sessão por si só; outro grupo pode ser criado depois. Clientes offline não recebem confirmação garantida de remoção, e precisam reconciliar estado ao voltar.

Na parada do servidor, a aplicação fecha salas enquanto as conexões ainda podem receber notificações, aguarda o fechamento gracioso dos transportes por até um segundo e só então força o encerramento do Engine.IO. Isso preserva eventos enfileirados em polling sem esperar indefinidamente por cliente sem resposta. Não é uma confirmação de leitura do usuário. Referência: [API de transporte do Socket.IO](https://socket.io/docs/v4/server-api/#socketconn).

Fotografias podem chegar antes do ack da ação. O cliente não deve substituir uma view recente por um ack antigo nem repetir mutações automaticamente após timeout. Deduplicação por `actionId` e limites de frequência ainda não são garantidos pelo serviço de lobby e permanecem obrigações das tarefas de robustez; autenticação, fila e projeção já estão ativas.

`buildPlayerView` cobre lobby, formato fechado e partidas com agregado da T14. Delega o jogo ao projetor explícito `buildMatchView`; partidas de validadores sem agregado retornam `null`. No fechamento, o publicador emite só remoção. A web reconhece o envelope de remoção, limpa sua store somente para a sala/versão atuais e apresenta a razão pública com retorno ao início. Visitar um convite não entra automaticamente; consultar uma sessão já associada pode recuperar sua própria sala pelo servidor.
