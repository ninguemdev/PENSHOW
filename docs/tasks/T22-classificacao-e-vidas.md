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

A base de classificação e conversão está implementada. D06 continua em consulta: o motor instalado não resolve empates automaticamente. O resumo dos planos isolados usa escopo explícito de protótipo e não inicia a final. A consolidação da política e a integração com as telas posteriores permanecem pendentes.

## Entregáveis

- [x] Criar classificação pura e estável por pontos e critérios confirmados, com registro da resolução de empates.
- [x] Converter colocações em 5 / 4 / 3 / 2 vidas e congelar a classificação de entrada na final.
- [x] Representar efeitos de desempate e necessidade de perguntas extras sem acoplar o domínio a sockets, caso D06 escolha essa opção.
- [x] Expor resumo público da conversão, preservando saldo anterior somente como histórico.
- [ ] Consolidar a política de desempate após a escolha de D06.

## Critérios de aceite

- [x] Líder sobrevive a quatro perdas; segundo a três; terceiro a duas; demais a uma.
- [x] Ausência de terceiro/quarto em salas pequenas não cria jogadores ou faixas adicionais.
- [x] Reconexão e acesso repetido ao retrato de entrada não convertem vidas novamente.
- [x] Ordem de entrada, socket e condição de anfitrião não decidem um empate.
- [ ] Validar a entrada na tela de final quando a T24 estiver integrada, conservando a mesma conversão.

## Verificação

- [x] Testar classificação com 2, 3, 4 e 12 jogadores, vários empates e propostas explicitamente experimentais.
- [ ] Validar a política definitiva após D06.
- [x] Testar conversão repetida, saldo congelado e independência de ordem de um Map de membros.

## Implementação e evidências

`final-entry.domain.ts` contém `prepareFinalEntry` e `resolveFinalTie`. O primeiro congela placar, classificação e atribuições de vidas uma única vez; o segundo aceita resultados explícitos de grupos residuais, sem alterar pontos ou acessar I/O. As propostas de acertos/sorteio/perguntas extras exigem política `prototype` explícita. A política instalada é `pending`: pontos empatados produzem grupos e `decision-required`, sem vidas atribuídas.

`FinalEntry` publica `ready` com classificação histórica e atribuições de vidas/perdas, ou `pending-tiebreak` com placar, grupos e próximo passo. Os schemas verificam evidências, posições, participantes, valores 5/4/3/2 e perdas 4/3/2/1. Reproduzem os registros para impedir classificação arbitrária entre empatados. Os planos isolados guardam o resumo no encerramento, com `scope: "isolated-prototype"`; isso não é uma final iniciada nem a sequência completa.

O agregado da sala protege uma conversão pronta contra alteração na mesma partida. Projeção e reconexão apenas recuperam o retrato, sem recalcular vidas. Serviço e rede cobrem resumo pronto e empate pendente, reconexão, conexão substituta e espectador; WebSocket e polling recebem o mesmo resultado.

Em 19/10/2026, `pnpm test` passou com **348 testes do servidor, 167 de shared, 109 da web, 32 de conteúdo e 5 de artes**, total **661**. Lint, tipagem e build passaram. O domínio cobre 2/3/4/12 participantes, empates parciais/múltiplos, saldo congelado, Map invertido, repetição, conflito, grupo inválido e as duas propostas residuais. A conversão de 12 empatados só atribui vidas após resultado explícito do grupo completo.

Guia: [classificacao-e-vidas.md](../classificacao-e-vidas.md). D06 permanece em consulta, sem alteração de `PENDING_DECISIONS` ou `decisoes.md`. A T23/T25 integrará a entrada real após as fases; as telas de vidas e perdas suportadas pertencem à T24.

O smoke clássico focado passou em **desktop 1280×900 e celular emulado 360×780**, com **2 percursos em 2,7 minutos**, sem retry. O navegador recebeu o resumo validado junto do encerramento: placar histórico **500/200**, **5/2 acertos**, atribuição **5/4 vidas**, **4/3 perdas suportadas** e perda eliminatória **5/4**. Perfil, convite, recarga, seis perguntas e retorno ao lobby continuaram funcionando. Os dados da conversão foram conferidos nos eventos públicos auditados, sem criar uma tela de final nesta etapa. A matriz completa das cinco modalidades não foi repetida nesta tarefa; a execução integral anterior está registrada na T21.

## Cuidados de implementação

A UI exibe vidas e perdas suportadas para evitar confundir cinco vidas com sobreviver a cinco perdas. Desempate não deve alterar pontos por efeito colateral.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
