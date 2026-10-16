# T25 — Pódio, histórico e revanche

- **Depende de:** [T24](./T24-final-na-web.md)
- **Pacotes:** server, web, shared
- **Marco:** M3
- **Branch sugerido:** `task/25-podio-e-revanche`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Concluir a partida, explicar o resultado e permitir jogar novamente sem recriar a sala.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [ ] Derivar pódio do último sobrevivente e ordem de eliminação; apresentar placar anterior como histórico.
- [ ] Exibir resumo por fase e ordem final sem recalcular vitória pelos pontos.
- [ ] Implementar retorno ao lobby, nova lista de participantes e continuidade da fila de escolha de tema.
- [ ] Limpar estado, timers, ações consumidas e vidas da partida encerrada, preservando perfil e sala.

## Critérios de aceite

- [ ] Campeão é o último com vida, mesmo se começou a final em colocação inferior.
- [ ] Espectadores e eliminados presentes podem participar da revanche.
- [ ] Nova partida ganha novos IDs e não aceita comandos/timers da anterior.
- [ ] Interrupção sem vencedor não produz pódio fictício.

## Verificação

- [ ] Testar vitória de quem entrou em quarto, ordem de eliminação e retorno ao lobby.
- [ ] Executar duas partidas consecutivas na mesma sala, incluindo jogador novo e um que saiu.

## Cuidados de implementação

O caminho de retorno precisa ser uma ação de serviço, não limpeza manual da store pelo navegador.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
