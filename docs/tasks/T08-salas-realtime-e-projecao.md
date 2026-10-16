# T08 — Salas em tempo real e projeção do lobby

- **Depende de:** [T07](./T07-dominio-e-servico-de-salas.md)
- **Pacotes:** server, shared
- **Marco:** M1
- **Branch sugerido:** `task/08-salas-realtime-e-projecao`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Expor a funcionalidade de salas em comandos autenticados e fotografias individuais de estado.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [analise-comicle.md](../analise-comicle.md)

## Entregáveis

- [ ] Registrar handlers `room:*` sobre os serviços, com validação e confirmações tipadas.
- [ ] Implementar `buildPlayerView` e publicação por membro, com versão de estado e instante do servidor.
- [ ] Controlar associação sessão/socket/sala, substituição de aba, autorização e evento de remoção.
- [ ] Atualizar protocolo e modelo de dados com o comportamento realmente disponível.

## Critérios de aceite

- [ ] Dois clientes observam o mesmo lobby e cada um recebe sua identidade e permissões corretas.
- [ ] Visão não expõe guestId, token, socketId nem dados privados de outro membro.
- [ ] Entrada, reconexão e mudança de perfil publicam uma visão coerente; componente de UI não precisa reconstruir deltas.

## Verificação

- [ ] Integrar servidor e clientes reais de Socket.IO para criar, entrar, sair e receber estado.
- [ ] Testar ator não autenticado, associação incorreta, aba substituída e projeção sem dados privados.

## Cuidados de implementação

Handlers não duplicam permissões ou regras do serviço. Privacidade de partidas será ampliada em T15, T23 e T28.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
