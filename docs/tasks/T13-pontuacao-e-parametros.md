# T13 — Pontuação pura e parâmetros de regras

- **Depende de:** [T02](./T02-contratos-e-documentacao.md)
- **Pacotes:** server, shared
- **Marco:** M2
- **Branch sugerido:** `task/13-pontuacao-e-parametros`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Concentrar cálculos e configurações para evitar números mágicos e regras duplicadas nas telas.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [decisoes.md](../decisoes.md)

## Entregáveis

- [ ] Definir parâmetros tipados por modalidade para pontos, prazos, quantidade de perguntas e limites.
- [ ] Criar funções puras de crédito/débito, aposta, transferência, acertos acumulados e variação de placar.
- [ ] Modelar a configuração congelada na partida e o histórico dos efeitos necessários à revelação.
- [ ] Separar os valores confirmados da final dos padrões experimentais de pontuação e duração.

## Critérios de aceite

- [ ] Cliente recebe valores explicativos do resultado, mas não calcula o placar oficial.
- [ ] Saldo nunca fica negativo; transferência conserva os pontos roubados; aposta não é descontada duas vezes.
- [ ] Os exemplos de 3.900 pontos máximos e saldo ilustrativo de 1.975 fecham com os padrões propostos.
- [ ] Trocar um parâmetro não exige alterar handlers, várias stores ou componentes.

## Verificação

- [ ] Testar limites de saldo, apostas acima do saldo, transferência de alvo com 30 pontos e fronteiras dos bônus.
- [ ] Testar composição dos efeitos puros e exemplos completos do plano; aplicação única pelo serviço será verificada nas tarefas do motor e das modalidades.

## Cuidados de implementação

A tabela proposta é configuração experimental, não prova de aprovação. Incorporar D01 quando respondida sem alterar 5 / 4 / 3 / 2 vidas.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
