# T08 — Salas em tempo real e projeção do lobby

- **Depende de:** [T07](./T07-dominio-e-servico-de-salas.md)
- **Pacotes:** server, shared
- **Marco:** M1
- **Branch sugerido:** `task/08-salas-realtime-e-projecao`

O status desta tarefa fica somente no [índice](README.md). As evidências abaixo descrevem os arquivos implementados e as verificações executadas.

## Objetivo

Expor a funcionalidade de salas em comandos autenticados e fotografias individuais de estado.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [analise-comicle.md](../analise-comicle.md)

## Entregáveis

- [x] Registrar handlers `room:*` sobre os serviços, com validação e confirmações tipadas.
- [x] Implementar `buildPlayerView` e publicação por membro, com versão de estado e instante do servidor.
- [x] Controlar associação sessão/socket/sala, substituição de aba, autorização e evento de remoção.
- [x] Atualizar protocolo e modelo de dados com o comportamento realmente disponível.

## Critérios de aceite

- [x] Dois clientes observam o mesmo lobby e cada um recebe sua identidade e permissões corretas.
- [x] Visão não expõe guestId, token, socketId nem dados privados de outro membro.
- [x] Entrada, reconexão e mudança de perfil publicam uma visão coerente; componente de UI não precisa reconstruir deltas.

## Verificação

- [x] Integrar servidor e clientes reais de Socket.IO para criar, entrar, sair e receber estado.
- [x] Testar ator não autenticado, associação incorreta, aba substituída e projeção sem dados privados.

## Evidências

- `apps/server/src/modules/rooms/room.handlers.ts` registra os seis comandos de sala. O dispatcher valida envelope e resultado; os handlers recebem identidade autenticada e repassam ao serviço com o ID da conexão, sem duplicar regras de negócio.
- `apps/server/src/modules/views/build-player-view.ts` seleciona explicitamente campos públicos de cada nível do lobby, com identidade do destinatário, presença e anfitrião. Não membro e partida ainda sem projetor recebem `null`. `room-publisher.ts` valida a mensagem e entrega somente à conexão atual de cada membro, compartilhando versão e instante da mutação.
- `RoomService.reconnect` recupera a associação pela identidade autenticada, conserva perfil/vaga e passa pela fila. O vínculo é revalidado antes de executar comandos enfileirados. A aba antiga não publica uma desconexão falsa ao ser substituída. Criação ainda provisória não pode ser recuperada como sala já confirmada.
- `roomRemovedSchema` e `serverEventSchema` contratam `room:removed`, com sala, versão e motivo público. Saída e expulsão preservam a sessão; fechamento usa somente esse evento terminal. Transporte/store web validam a remoção, conferem sala/versão e limpam a associação sem restaurá-la por uma visão atrasada. A apresentação e os controles do lobby ficam em T09.
- `room.realtime.test.ts` usa servidor e clientes reais, cobrindo polling/WebSocket, visões individuais, perfil/configurações, permissões, lotação, avatar inválido, troca de aba, queda física, transferência de anfitrião, expiração e substituição enquanto há comandos na fila, saída, expulsão, banimento e fechamento.
- Os testes em rede revelaram perda do evento terminal ao fechar polling. `platform/realtime/close-connections.ts` agora aguarda o fechamento gracioso do transporte por até 1 segundo antes de forçar a limpeza. Testes verificam entrega terminal em polling/WebSocket e o limite com transporte que não responde, incluindo remoção de timers/listeners.
- Testes de projeção injetam campos secretos em estado, conexão, perfil, avatar e configurações; nenhum é propagado. Cobrem destinatário correto, falha isolada de entrega e remoção terminal. Contratos compartilhados e stores web cobrem payloads inválidos, sala/versão incorretas e preservação da identidade.
- Verificações executadas: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm avatars:check`, `pnpm build`, `pnpm install --frozen-lockfile` e `git diff --check`. A suíte passou com **375 testes**: 159 shared, 150 server, 53 web, 8 de conteúdo e 5 de artes. As 50 artes também passaram na verificação do catálogo.
- Smoke do JavaScript compilado: sessões obtidas por HTTP, dois clientes Socket.IO compartilhando lobby com `viewerId` próprio, atualização de perfil/configurações, reconexão automática da associação em nova aba, encerramento da aba substituída, inspeção de campos privados, expulsão/saída e registro de salas vazio no final. Processo encerrou sem transportes ou timers pendentes.

Consulte [salas](../salas.md), [protocolo](../protocolo-realtime.md), [modelo de dados](../modelo-de-dados.md) e [servidor](../servidor.md). Partidas, conteúdo editorial, limites de frequência e registro/deduplicação de ações continuam nas tarefas correspondentes; esta entrega não declara esses recursos disponíveis.

## Cuidados de implementação

Handlers não duplicam permissões ou regras do serviço. Privacidade de partidas será ampliada em T15, T23 e T28.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
