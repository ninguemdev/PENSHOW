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

- [ ] Adaptar código da sala, registro por código/ID, membros e `Room.runExclusive`.
- [ ] Implementar criação, entrada, saída, perfil, configurações, presença, expulsão no lobby e transferência de anfitrião.
- [ ] Substituir dependências de `StoryRepository` e `Match` de quadrinhos por contratos próprios de ciclo de vida e quiz.
- [ ] Gerenciar colisão de código, capacidade, sessões substituídas e encerramento com limpeza de timers.

## Critérios de aceite

- [ ] Sala aceita o limite configurado de participantes e reconecta um membro existente mesmo quando cheia.
- [ ] Falha numa mutação não trava a fila; timers de outra partida ou sala não alteram a atual.
- [ ] Só anfitrião configura/inicia; expulsão não altera uma partida em andamento.
- [ ] Toda alteração de membro ou estado passa pela fila da sala.

## Verificação

- [ ] Testar colisão de código, sala cheia, ator de outra sala, expulsão e anfitrião ausente.
- [ ] Testar duas mutações concorrentes, tarefa rejeitada seguida de sucesso e limpeza ao fechar.

## Cuidados de implementação

Domínio de sala não depende de Socket.IO nem banco. Capacidade inicial proposta: 2 a 12 jogadores, mantendo o valor em configuração tipada.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
