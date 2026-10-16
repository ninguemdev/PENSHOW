# T22 — Classificação, desempates e atribuição de vidas

- **Depende de:** [T13](./T13-pontuacao-e-parametros.md)
- **Pacotes:** server, shared
- **Marco:** M3
- **Branch sugerido:** `task/22-classificacao-e-vidas`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Converter o desempenho acumulado em vantagem na final preservando exatamente as perdas às quais cada colocação deve sobreviver.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [decisoes.md](../decisoes.md)

## Decisões em consulta

D06 define o desempate residual. Comparação por pontos/acertos e sorteio residual é proposta; não apresentá-la como decisão confirmada.

## Entregáveis

- [ ] Criar classificação pura e estável por pontos e critérios confirmados, com registro da resolução de empates.
- [ ] Converter colocações em 5 / 4 / 3 / 2 vidas e congelar a classificação de entrada na final.
- [ ] Representar efeitos de desempate e necessidade de perguntas extras sem acoplar o domínio a sockets, caso D06 escolha essa opção.
- [ ] Expor resumo público da conversão, preservando saldo anterior somente como histórico.

## Critérios de aceite

- [ ] Líder sobrevive a quatro perdas; segundo a três; terceiro a duas; demais a uma.
- [ ] Ausência de terceiro/quarto em salas pequenas não cria jogadores ou faixas adicionais.
- [ ] Reconexão e entrada na tela de final não convertem vidas novamente.
- [ ] Ordem de entrada, socket e condição de anfitrião não decidem um empate.

## Verificação

- [ ] Testar classificação com 2, 3, 4 e 12 jogadores, vários empates e a política escolhida.
- [ ] Testar conversão repetida, saldo congelado e independência de ordem de um Map de membros.

## Cuidados de implementação

A UI exibe vidas e perdas suportadas para evitar confundir cinco vidas com sobreviver a cinco perdas. Desempate não deve alterar pontos por efeito colateral.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
