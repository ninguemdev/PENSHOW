# Quiz clássico no servidor

A T15 conecta o motor da T14 a sessões autenticadas e Socket.IO em `app.ts`. O protótipo fica disponível com `NODE_ENV=development` ou `test`. Em `production`, a aplicação não instala `MatchService`, sua porta `quiz` ou seus handlers; os comandos de partida retornam `INVALID_PHASE`. Não existe opção enviada pelo cliente para habilitar o modo curto.

O fluxo tem **uma fase e seis perguntas**, três fáceis e três médias, sem repetição na partida. As perguntas vêm apenas do catálogo privado aprovado. Cada acerto vale **+100**; erro ou ausência vale **zero**. Os valores seguem a configuração experimental da T13; D01–D06 permanecem em consulta. O protótipo não executa as outras quatro modalidades, classificação, vidas, final ou pódio.

A [T18](velocidade.md) acrescenta velocidade como outro protótipo isolado: `match:start` aceita `mode: "speed"`, enquanto ausência ou `mode: "classic"` conserva o fluxo deste documento. A sequência completa continua pendente.

A [T19](aposta.md) acrescenta `mode: "wager"`, com escolha privada antes do enunciado e liquidação única. Os três modos reutilizam o mesmo motor; os comandos de aposta só são aceitos no subestado apropriado dessa modalidade.

A [interface da T16](quiz-classico-web.md) conecta início, perguntas, resposta, revelação, placar e retorno ao lobby aos comandos/visões deste fluxo. O protótipo pode ser exercitado na web em desenvolvimento/teste; não há partida completa ou versão publicada. A [T17](smoke-m2.md) adicionou o smoke permanente de perfil, sala e jogo em Playwright e sua configuração na CI.

## Comandos e ciclo

Todos os comandos usam o envelope versão 1 com `actionId`. O ator e a conexão vêm da sessão; o serviço os revalida dentro da fila da sala.

| Evento | Contexto e comportamento |
|---|---|
| `match:start` | `roomId`; anfitrião no lobby, pelo menos dois participantes conectados e estoque suficiente. Retorna `matchId` e versão |
| `round:ready` | `roomId`, `matchId`, `roundId`; confirma prontidão nas instruções. Repetição não altera versão |
| `category:choose` | Mesmo contexto e `category`; somente o participante sorteado, entre os temas oferecidos e antes do prazo |
| `answer:submit` | Mesmo contexto, `questionId`, `optionId`; registra uma escolha definitiva, com ack `acceptance: recorded` e versão |
| `match:returnToLobby` | `roomId`, `matchId`; anfitrião, somente depois de `prototype-complete` ou `interrupted` |

`match.handlers.ts` apenas adapta comandos/acks e encontra a sala. Regras, avaliação e timers ficam no motor/serviços. Desde T19, `wager:submit` exige modalidade/etapa de aposta; T20 conecta `target:choose` somente ao protótipo de roubo, cuja variante depende de D05. O cliente não envia pontos, acerto, identidade do autor ou horário de recebimento.

As instruções têm até 15 segundos, o tema até dez e a leitura dura três. O prazo de resposta é de 15 segundos após a abertura anunciada; todos responderem encerra antes. A revelação dura quatro segundos mais um segundo de transição; o resultado de fase dura oito. Todos os números são parâmetros congelados para aquela partida.

A janela é `opensAt <= receivedAt < deadlineAt`, medida no momento em que o comando executa na fila. Uma resposta no prazo exato é recusada. Opção de outra pergunta, contexto antigo, jogador de outra sala e espectador não consomem a oportunidade. O mapa privado associa UUIDs de opções ao gabarito editorial; a posição da alternativa não decide o acerto.

Repetir uma resposta, inclusive com outro `actionId`, não credita novamente. O reenvio pode receber `ALREADY_ANSWERED`, `INVALID_PHASE` ou `STALE_CONTEXT`, conforme o estado atual. A T15 não implementa cache de ack por `actionId`; o cliente deve reconciliar pela fotografia atual e não repetir mutações automaticamente após timeout.

## Visões e progresso

`MatchView.progress` contém `roundNumber`, `roundCount`, `questionNumber` e `questionCount`. O modo atual publica fase **1 de 1**, com **0 de 6** antes da primeira pergunta, **1 a 6 de 6** durante perguntas/revelações e **6 de 6** no encerramento. O schema recusa contagens fora do plano e conclusão parcial.

| Momento | Participantes, inclusive anfitrião | Espectador |
|---|---|---|
| Instruções/tema | Regra/fase, progresso, prontidão ou temas oferecidos | Mesmos campos públicos |
| Leitura | Enunciado, tema, dificuldade e abertura, sem opções/gabarito | Mesmo conteúdo |
| Resposta | Opções, prazos, IDs de quem respondeu e somente a própria alternativa | Opções/prazos/progresso e `ownAnswer: unavailable` |
| Revelação | Gabarito, explicação, créditos efetivos e placar atualizado | Mesmo resultado público |
| Resultado/conclusão | Placar e progresso; `prototype-complete` explicita o fim do plano curto | Mesmo resultado público |

Ack de resposta não informa acerto, gabarito ou pontos. Antes de fechar a pergunta, o placar também não adianta o resultado de uma resposta recebida. Fonte, IDs editoriais, mapa de alternativas, recibos, checkpoint e perguntas futuras permanecem privados.

A nova conexão autenticada recebe a fotografia atual sem reenviar o código da sala. Se já respondeu, recupera `ownAnswer: submitted` e a alternativa escolhida; o prazo não reinicia. Uma ação da conexão substituída que aguardava na fila é rejeitada. Nenhuma reconexão recria placar ou resolução.

Os schemas e consumidores do monorepo foram atualizados juntos para o campo obrigatório `progress`. A versão 1 ainda está em desenvolvimento, sem clientes publicados independentes; clientes que validam objetos estritos precisam usar os contratos atuais.

## Verificação

`match.realtime.test.ts` usa o aplicativo composto, sessões HTTP, clientes Socket.IO em portas efêmeras, catálogo real de 72 perguntas e tempo manual. Percorre as seis perguntas em WebSocket e polling, com duas sessões de jogador e uma de espectador, passando por toda a matriz acima.

Também cobre respostas concorrentes, reenvio, campo privado injetado, alternativa inválida, contexto de outra partida, prazo exato, reconexão após resposta, substituição durante espera na fila, falta de estoque, falha interna sanitizada, retorno ao lobby, novo `matchId`, bloqueio em produção e encerramento sem tarefas pendentes. Os testes de domínio e serviço da T14 continuam validando rollback e timers antigos. Evidências estão na [T15](tasks/T15-quiz-classico-servidor.md).
