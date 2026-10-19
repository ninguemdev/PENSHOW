# T07 — Domínio e serviço de salas

- **Depende de:** [T04](./T04-identidade-convidado.md)
- **Pacotes:** server, shared
- **Marco:** M1
- **Branch sugerido:** `task/07-dominio-e-servico-de-salas`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Criar salas com membros, anfitrião e mutações serializadas, removendo o acoplamento a histórias do Comicle.

## Leia antes

- [analise-comicle.md](../analise-comicle.md)
- [arquitetura.md](../arquitetura.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Entregáveis

- [x] Adaptar código da sala, registro por código/ID, membros e `Room.runExclusive`.
- [x] Implementar criação, entrada, saída, perfil, configurações, presença, expulsão no lobby e transferência de anfitrião.
- [x] Substituir dependências de `StoryRepository` e `Match` de quadrinhos por contratos próprios de ciclo de vida e quiz.
- [x] Gerenciar colisão de código, capacidade, sessões substituídas e encerramento com limpeza de timers.

## Critérios de aceite

- [x] Sala aceita o limite configurado de participantes e reconecta um membro existente mesmo quando cheia.
- [x] Falha numa mutação não trava a fila; timers de outra partida ou sala não alteram a atual.
- [x] Só anfitrião configura/inicia; expulsão não altera uma partida em andamento.
- [x] Toda alteração de membro ou estado passa pela fila da sala.

## Verificação

- [x] Testar colisão de código, sala cheia, ator de outra sala, expulsão e anfitrião ausente.
- [x] Testar duas mutações concorrentes, tarefa rejeitada seguida de sucesso e limpeza ao fechar.

## Cuidados de implementação

Domínio de sala não depende de Socket.IO nem banco. Capacidade inicial proposta: 2 a 12 jogadores, mantendo o valor em configuração tipada.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 16/10/2026

- Branch `task/07-dominio-e-servico-de-salas`, preservando as entregas anteriores do workspace. Módulo em `apps/server/src/modules/rooms/`, composto como `app.rooms`. Reutilização do Comicle registrada em `THIRD_PARTY_NOTICES.md`, com licença MIT preservada.
- `Room`, registro por ID/código e reserva por PlayerId, fila com rascunho isolado, descarte de tarefa rejeitada e versão crescente por commit. Invariantes de capacidade/anfitrião/elenco são verificadas antes de armazenar. Snapshots e referências externas não alteram o agregado; erro não interrompe as próximas tarefas.
- Serviço implementa criar/entrar/sair, perfil normalizado e catálogo, configurações exclusivas do anfitrião, presença, reconexão com capacidade esgotada, expulsão somente no lobby e bloqueio da mesma identidade até o fechamento. Identidade em outra sala é rejeitada, inclusive em admissões concorrentes entre duas filas. Retorno da mesma identidade substitui a conexão; comandos/desconexões antigos não atingem a conexão nova.
- `ROOM_LIMITS` centraliza capacidade de 2–12 jogadores, limite total de 100 membros e alfabeto/código de seis caracteres. Colisões de código têm 20 tentativas e colisões de ID não sobrescrevem salas. Novo erro público `NOT_ENOUGH_PLAYERS` informa o mínimo de dois conectados para iniciar.
- Política tipada e injetável mantém carência de anfitrião (30s), remoção no lobby (120s), sala sem conexões (120s) e idade máxima (12h) como valores de protótipo. Relógio/agendador/IDs/RNG são portas existentes. Não há timers nativos, transporte ou banco no domínio.
- Timers passam pela fila e reconferem sala, token de agendamento e epoch de fase depois da espera. Reconexão, nova partida, encerramento e reutilização de código invalidam callbacks antigos, inclusive já entregues à fila. Mutação alheia não estende os prazos. Fechamento libera registro/associações e cancela timers; `app.close()` aguarda as salas antes de encerrar o agendador.
- Limite próprio `QuizLifecycle`/`QuizRoster` congela configurações e perfis de jogadores; não existe `StoryRepository` ou `Match` de quadrinhos. Preparação inválida preserva o lobby; novos membros durante o ciclo entram como espectadores. Participantes ausentes conservam vaga/perfil, e retorno ao lobby dá nova carência de remoção. A composição de produção não injeta o motor ainda ausente e não inicia uma partida fictícia.
- **31 testes novos de salas** e um de composição/encerramento, com relógio e RNG determinísticos, sem sleeps: colisão, limite, última vaga disputada, admissão entre salas, autenticação dentro da fila, rollback/continuidade, referências isoladas, anfitrião ausente/retorno/saída, expulsão, elenco congelado, limite de espectadores, contexto de partida antigo, callback cancelado/atrasado, TTL/idade e fechamento com tarefa pendente.
- **343 testes passaram**: 151 shared, 128 servidor, 51 web, oito de conteúdo e cinco de artes. `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm avatars:check`, `pnpm build`, `pnpm install --frozen-lockfile` e `git diff --check` passaram. Sem novas dependências.
- Smoke do artefato compilado com `buildApp` em porta efêmera: HTTP de saúde/sessões e dois sockets autenticados reais, chamadas diretas ao serviço interno para criação/entrada/perfil/presença/substituição e registro vazio após `app.close()`. O comando de sala enviado pelo socket ainda retorna `INVALID_PHASE`, confirmando que a integração de T08 não foi antecipada.
- [Salas](../salas.md), arquitetura, servidor, modelo de dados, protocolo, sessões, README e atribuição atualizados. A CI hospedada depende de enviar o branch.

T08 conectará autenticação, associação socket/sala, handlers e projeções privadas por destinatário; T09 conectará a interface. Fases do quiz, pausa e reconexão completa continuam nas tarefas próprias. A política de ciclo documentada não transforma D01–D08 em decisões respondidas.
