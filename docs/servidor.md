# Servidor e infraestrutura realtime

O servidor executa Fastify e Socket.IO no mesmo servidor HTTP. Saúde, `time:sync`, [sessões de convidado](sessoes.md) e os seis comandos `room:*` estão disponíveis na rede. O [serviço de salas](salas.md) está composto em `app.rooms`, com projeções por destinatário. A [T15](quiz-classico.md) compõe o motor e cinco comandos de partida somente em desenvolvimento/teste; `app.matches` fica ausente em produção. Os envelopes seguem o [protocolo versão 1](protocolo-realtime.md).

## Composição

`apps/server/src/app.ts` exporta `buildApp(deps)`, que retorna uma instância Fastify com `runtime`, `realtime`, `config`, o registro privado `sessions`, o serviço interno `rooms` e o repositório privado `questions`. Construir a aplicação não abre portas nem instala handlers de sinais do processo. `app.inject()` permite testar HTTP sem rede; `app.listen({ host: '127.0.0.1', port: 0 })` permite integração em porta efêmera.

| Dependência opcional | Responsabilidade |
|---|---|
| `config` | Configuração já carregada, revalidada e congelada na composição |
| `runtime` | Relógio, agendador, IDs e sorteio injetáveis |
| `sessionTokens` | Emissão/hash de tokens injetáveis; produção usa 32 bytes criptográficos e SHA-256 com domínio PENSHOW |
| `handlers` | Registro de adaptadores de comando, indexado pelos eventos contratados |
| `logStream` | Destino dos logs, inclusive captura nos testes |
| `roomPolicy` | Prazos tipados de anfitrião, ausência e duração máxima de salas |
| `questions` | Porta de leitura já preparada, para testes ou outro adaptador local |
| `questionCatalogFile` | Caminho/URL de arquivo privado para o adaptador local; não é parâmetro HTTP |

Sem dependências, a composição usa configuração local, relógio/IDs/sorteio/tokens de produção e registro de sessões em memória. Não existe usuário de desenvolvimento autenticado automaticamente: o cliente emite uma sessão pela rota HTTP. `main.ts` lê o ambiente, inicia a escuta e registra SIGINT/SIGTERM para chamar `app.close()`.

No `onReady`, antes da varredura de sessões e de aceitar requisições, o adaptador carrega `data/questions/published/catalog.json`. O caminho é relativo ao módulo fonte/compilado, independente do diretório de execução. A leitura valida esquema, revisão, gabarito, fontes/licenças e manifesto/hash; arquivo ausente/inválido ou acima de 32 MiB impede o startup com erro fixo de catálogo, sem imprimir registros privados. O repositório disponibiliza cópias filtradas e contagens em memória, sem HTTP novo. Distribuir o arquivo privado com a aplicação e executar `pnpm questions:check` na preparação; o build não promove conteúdo. A T11 publica 72 perguntas revisadas, carregadas após reiniciar o servidor. Esse lote inicial não habilita o motor de partidas. Consulte [perguntas](perguntas.md).

`QuestionSelection.create(app.questions, { ids, random }, options)` prepara uma instância por partida após o carregamento. A [seleção da T12](selecao-de-perguntas.md) faz snapshot do catálogo, verifica a mistura por fase, reserva a final no formato completo experimental e preserva perguntas/IDs em reconsultas. Os métodos recebem instante explícito e não instalam timers; `MatchService` da T14 executa as operações em checkpoints na fila da sala e agenda a expiração por contexto. A fila para revanche deve ser guardada pelo dono da sala e fornecida à próxima instância. O módulo não está ligado a comandos Socket.IO nem altera o início desabilitado do lobby.

A [T13](pontuacao-e-parametros.md) fornece `freezeMatchRules` e os cálculos puros de pontuação. O motor da T14 conserva a mesma configuração ao chamar seleção e a estratégia clássica, confirmando placares/efeitos uma vez por pergunta para a revelação. Apostas são seladas sem débito antecipado e liquidadas na resolução; roubo transfere somente após os créditos de acerto. Esses cálculos das outras modalidades permanecem disponíveis para suas tarefas de implementação. Recibos de resposta usam tempo e avaliação internos, nunca campos do cliente.

No encerramento, `rooms.dispose()` bloqueia operações novas, aguarda filas, cancela o timer de partida e notifica a remoção antes de liberar as conexões. O fechamento gracioso do transporte tem limite de um segundo; em seguida são encerrados Engine.IO, sessões e agendador. O módulo de domínio de salas não conhece Socket.IO, banco ou histórias. A composição injeta `QuizLifecycle` com o motor clássico apenas fora de produção, usando o mesmo predicado de conexão atual das salas.

O registro recebe ator identificado e envelope validado. `room.handlers.ts` captura o ID da conexão no servidor e chama serviços com ator/payload; o domínio não recebe socket, handshake ou callback de confirmação. Associação e credencial/conexão ativa são reconferidas dentro da fila. O resultado do adaptador passa pelo schema específico daquele evento antes de sair do servidor. Um resultado incompatível recebe `INTERNAL_ERROR` e não é enviado em parte.

## Configuração

`platform/config.ts` fornece `loadConfig(environment)` e `validateConfig(value)`. Ambos falham com mensagem em pt-BR, sem repetir valores inválidos. Configuração inválida é recusada antes de criar o transporte.

| Variável | Padrão | Validação |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` ou `production` |
| `HOST` | `127.0.0.1` | IP ou nome de host |
| `PORT` | `3000` | Inteiro de 1 a 65535; testes usam porta 0 diretamente em `listen` |
| `ALLOWED_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173` | De 1 a 16 origens HTTP(S) exatas, sem repetição, separadas por vírgula; obrigatória em produção |
| `HTTP_BODY_LIMIT` | `65536` | De 1024 a 1048576 bytes |
| `SOCKET_MESSAGE_LIMIT` | `65536` | De 1024 a 1048576 bytes |
| `LOG_LEVEL` | `info`; `silent` em testes | Níveis do logger: silent/fatal/error/warn/info/debug/trace |
| `GUEST_SESSION_TTL_MS` | `86400000` (24 horas) | Inteiro de 1000 a 604800000; renovação explícita da janela |

Origens não incluem caminho, credenciais, query ou barra final. Não usar `*` ou `null`. Configurações e sua lista de origens ficam congeladas em execução. Os limites de bytes são orçamentos de transporte; os schemas continuam verificando limites e estrutura dos campos.

`.env.example` documenta as variáveis. A aplicação lê o ambiente do processo e **não carrega `.env` automaticamente**. Para usar um arquivo a partir da raiz depois do build:

```sh
node --env-file=.env apps/server/dist/main.js
```

`pnpm dev`/`pnpm start` usam as variáveis exportadas pelo shell. Ao alterar a porta HTTP local, ajuste também o destino do proxy Vite em `apps/web/vite.config.ts`.

## Rede, origem e comandos

Socket.IO usa o caminho **`/penshow/socket.io`**, distinto de `/socket.io` e de caminhos do Comicle. O bundle de cliente não é servido pelo servidor. O cliente futuro deve configurar o mesmo caminho; essa configuração é independente do caminho base de páginas web.

Polling e WebSocket estão habilitados. A origem é conferida no handshake por `allowRequest`, além dos cabeçalhos CORS. HTTP recusa origem explícita não permitida com 403; preflight válido recebe os cabeçalhos CORS. Clientes sem `Origin`, como ferramentas nativas, podem conectar. Origem não autentica um jogador.

Um evento nomeado deve levar exatamente um envelope e um callback de confirmação. O nome do evento deve corresponder a `envelope.event`. Eventos sem callback são ignorados sem executar serviço; argumentos adicionais são inválidos. O adaptador verifica tamanho serializado e schema antes de chamar o identificador do ator.

`time:sync` consulta somente o relógio injetado e não exige sessão. Retorna o horário local ecoado e os instantes de recepção/envio do servidor; um recuo do relógio não faz `serverSentAt` anteceder `serverReceivedAt`. O relógio do cliente não decide prazo ou prioridade.

Os demais comandos válidos exigem prova de sessão válida e conexão ativa. O handshake recebe somente `{ token }` ou `{}` para consulta anônima; nomes ou IDs declarados não autenticam. O token em claro é removido de `handshake.auth` após a validação. Um comando cujo adaptador ainda não está registrado recebe `INVALID_PHASE` quando autenticado. Não há comandos de jogo com sucesso fictício.

Mensagem maior que `maxHttpBufferSize` é rejeitada pelo Engine.IO, podendo encerrar a conexão antes de existir confirmação. Um envelope recebido, mas inválido ou maior que o limite interno, recebe `INVALID_PAYLOAD`. Eventos desconhecidos recebem `UNKNOWN_EVENT`. Duração/renovação estão em [sessões](sessoes.md); autorização de sala, fila, deduplicação e rate limits específicos serão adicionados nas tarefas correspondentes.

As opções de caminho, limite e origem seguem a [documentação de opções do Socket.IO](https://socket.io/docs/v4/server-options/); a validação de origem também considera a [distinção entre CORS e WebSocket](https://socket.io/docs/v4/handling-cors/). Foram instalados e verificados Socket.IO/cliente 4.8.4 e `@fastify/cors` 11.3.1 com Fastify 5.12.7.

## Portas e tempo controlado

`apps/server/src/ports.ts` não importa Node, rede ou UI:

| Porta | Operação |
|---|---|
| `Clock` | `now()` em milissegundos Unix |
| `Scheduler` | `scheduleAt(deadline, task)` devolve cancelamento; `dispose()` encerra |
| `IdGenerator` | `next()` gera UUIDv4 opaco |
| `RandomSource` | `integer(maxExclusive)` sorteia em `[0, maxExclusive)` |

As implementações de produção ficam em `platform/`: relógio do sistema, `setTimeout` com controle de tarefas, `crypto.randomUUID` e `crypto.randomInt`. O limite do sorteio é inteiro de 1 a `2^48 − 1`. O gerador de IDs também fornece os IDs de requisição HTTP, sem aceitar um identificador enviado pelo cliente.

O agendador aceita prazos inteiros seguros não negativos, divide esperas maiores que o limite de `setTimeout`, reconfere o relógio antes de executar e mantém cancelamento idempotente. Uma tarefa que já começou pode terminar; cancelamento impede a execução das que ainda não começaram. Exceções são reportadas sem impedir tarefas posteriores.

`test-support/runtime.ts` fornece relógio/agendador manual, IDs sequenciais válidos e sorteio por sequência explícita. O avanço processa tarefas por prazo e ordem de registro, inclusive tarefas novas dentro do avanço. Cancelamento e encerramento removem as pendentes; o encerramento aguarda tarefas em andamento. Esse suporte e as suítes de teste não integram o build do servidor.

Domínio e serviços recebem somente as portas necessárias. As regras ainda não implementadas não devem chamar `Date.now`, `Math.random` ou timers globais; a composição conhece as implementações concretas. Timers futuros também carregarão IDs de sala/partida/fase/pergunta para impedir efeitos de contextos antigos.

## Erros, logs e encerramento

`PublicCommandError` expressa códigos públicos conhecidos sem exigir uma biblioteca de transporte. Exceções inesperadas do identificador, adaptador ou validação de saída viram `INTERNAL_ERROR`. HTTP trata erros de parsing/tamanho como `INVALID_PAYLOAD` (400/413/415), caminhos inexistentes como `NOT_FOUND` (404) e exceções inesperadas como `INTERNAL_ERROR` (500).

As respostas não expõem stack, mensagem interna, payload ou URL recebida. Logs automáticos de requisição são desabilitados pelo `LogController` do Fastify. Os serializers e a redação removem requisição/resposta/erro e campos sensíveis; os caminhos de falha da aplicação registram mensagens fixas, sem tokens, alternativas ou corpo. Testes capturam o stream real dos logs HTTP e de socket e verificam que valores privados não aparecem.

`app.close()` usa os hooks de ciclo de vida do Fastify:

1. Bloqueia novas conexões e despachos.
2. Cancela vínculos/timers de sessão, desconecta sockets, encerra clientes Engine.IO e limpa o registro de sessões.
3. Aguarda tarefas agendadas e comandos que já começaram.
4. Fecha a escuta HTTP e o restante do Socket.IO.

Os recursos do runtime injetado pertencem à instância que o recebe; não compartilhar o mesmo agendador entre aplicações independentes. Os testes verificam encerramento antes de `listen`, fechamento repetido, transporte ativo e comando em andamento. Adaptadores futuros devem concluir ou cancelar seu próprio trabalho; não foi criado um timeout que abandona silenciosamente um efeito em andamento.

## Verificação

As suítes do servidor cobrem configuração, saúde e erros HTTP, limites, CORS, despacho, saída inválida, tempo/agendamento e conexões reais em polling/WebSocket. Usam `inject`, porta efêmera, eventos de rede, relógio manual e timers falsos; não dependem de sleeps nem esperam os prazos reais do jogo. Os checks continuam integrados a `pnpm test` e à CI de qualidade.

Sessões autenticam os comandos, e serviços de sala, projeção do lobby e presença estão implementados. Regras/projeções de partida continuam nas tarefas próprias. O transporte não anuncia uma partida jogável nem altera as decisões D01–D06.
