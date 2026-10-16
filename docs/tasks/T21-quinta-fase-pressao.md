# T21 — Quinta fase de pressão e dinamite

- **Depende de:** [T17](./T17-primeiro-marco-jogavel.md), [T13](./T13-pontuacao-e-parametros.md)
- **Pacotes:** server, web, shared
- **Marco:** M3
- **Branch sugerido:** `task/21-quinta-fase-pressao`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Implementar a quinta modalidade com oportunidades equivalentes e prazo individual completo.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [decisoes.md](../decisoes.md)

## Decisões em consulta

D04 escolhe dinamite, destaque simultâneo ou sequência. Esta ficha descreve a dinamite proposta; atualizar a ficha se a escolha mudar, mantendo sua posição na sequência.

## Entregáveis

- [ ] Para dinamite, agendar dois ciclos, uma pergunta média e uma difícil por participante, com ordem sorteada e segundo ciclo inverso.
- [ ] Autorizar resposta apenas ao dono do turno; conceder dez segundos completos após a leitura.
- [ ] Aplicar +300 por acerto ou débito de até 150 por erro/ausência, preservando saldo mínimo zero.
- [ ] Mostrar dono, ciclo, pavio individual, passagem ou explosão e próximo turno; integrar ao resultado da quinta fase.

## Critérios de aceite

- [ ] Cada participante recebe dois turnos mesmo quando erra ou está temporariamente ausente.
- [ ] Explosão não remove da partida nem tira vida; próximo jogador não recebe prazo restante do anterior.
- [ ] Ordem de turnos independe da ordem de respostas e do anfitrião.
- [ ] Repetir um comando não passa dois turnos nem aplica duas penalidades.

## Verificação

- [ ] Testar 2, 4 e 12 participantes, quantidade de turnos e distribuição de dificuldade.
- [ ] Testar erro/timeout com saldo 50, acerto, envio por outro jogador e prazo completo após explosão.

## Cuidados de implementação

Não transportar o cronômetro global de uma dinamite entre pessoas. Valores permanecem parametrizados e sujeitos ao equilíbrio de T32.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
