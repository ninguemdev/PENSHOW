# T39 — Desempate por minigame de tiro 2D top-down

- **Depende de:** [T23](./T23-final-no-servidor.md), [T24](./T24-final-na-web.md), [T25](./T25-podio-e-revanche.md), [T28](./T28-privacidade-limites-e-concorrencia.md)
- **Pacotes:** server, shared, web, e2e
- **Marco:** M3
- **Branch sugerido:** `task/39-desempate-tiro-top-down`

O status desta tarefa fica somente no [índice](README.md). Escopo acrescentado pelo usuário em 23/10/2026, conforme D09 em [decisões](../decisoes.md). O [plano detalhado de implementação](../plano-desempate.md) define arquitetura, estados, parâmetros iniciais, rede, etapas e validação. A implementação está integrada em desenvolvimento/teste; o [guia da entrega](../desempate-tiro.md) descreve os módulos, controles, rede e limites. As evidências executadas estão registradas abaixo.

## Objetivo

Desempatar participantes eliminados simultaneamente na final por meio de um minigame multiplayer de tiro em visão 2D top-down. Integrar o resultado às colocações da final e ao pódio, inclusive quando a perda coletiva de D02 deixa o quiz sem sobreviventes. O minigame pertence ao desempate da quinta fase; não acrescenta uma sexta fase sorteável.

## Regras confirmadas

- Mais de um participante eliminado na mesma resolução forma o grupo de desempate; perder uma vida e continuar ativo no quiz não inicia um combate.
- Apenas os empatados participam do minigame de tiro 2D top-down.
- Cada participante começa com **3 vidas**, separadas das vidas da final de quiz.
- Ao chegar a **zero vidas**, o jogador recebe uma pergunta.
- Resposta **errada**: o jogador morre e é eliminado do minigame.
- Resposta **correta**: o jogador recebe **1 vida** e continua no minigame. Uma nova chegada a zero volta a aplicar a mesma regra.
- O empate em pontos/acertos antes da final segue D06, com colocação compartilhada e vidas iguais, sem disparar este minigame.

## Plano de execução

O [plano de implementação](../plano-desempate.md) detalha nove unidades de entrega, com critérios de conclusão. As escolhas de arena, controles e prazos são parâmetros de protótipo, separados das regras confirmadas; não constituem novas decisões atribuídas ao usuário.

- [x] **T39-A — Grupos e classificação:** aplicar os pontos necessários de D02/D06; representar eliminações simultâneas, zero ativos no quiz e posições ainda pendentes.
- [x] **T39-B — Contratos e estados:** distinguir vidas do quiz/combate, pergunta própria, lotes e resultado; validar permissões e contexto.
- [x] **T39-C — Simulação:** implementar movimento, tiro e colisões em passos fixos de 50 ms, com resolução de impactos por lote.
- [x] **T39-D — Perguntas:** selecionar perguntas privadas inéditas por lote; erro elimina, acerto devolve uma vida, inclusive em recuperações repetidas.
- [x] **T39-E — Serviço e rede:** integrar à fila da sala, orçamento próprio de entradas contínuas, quadros compactos e reconexão.
- [x] **T39-F — Arena web:** Canvas 2D, controles de computador/toque, HUD e perguntas HTML acessíveis, espectadores, som e narração.
- [x] **T39-G — Resultado integrado:** resolver subgrupos ainda empatados, preservar sobreviventes do quiz, preencher pódio e limpar tudo na revanche.
- [x] **T39-H — Integração e carga:** verificar 2/4/12 combatentes, múltiplas salas, privacidade, prazos, callbacks antigos e desktop/celular.
- [x] **T39-I — Consolidação:** atualizar T29/T32/T36, documentação e evidências; validar ou preparar avaliação humana sem inventar resultados.

A primeira versão pausa o quiz para resolver o grupo e pausa a arena durante os lotes de perguntas de sobrevivência. As perguntas do mesmo lote são distintas e privadas, abertas em paralelo; o combate aguarda todas as respostas/prazos antes de retomar. Vencedor do grupo não recupera vida de quiz; se todos os ativos do quiz foram eliminados, ele é o campeão por resultado do desempate. Empates internos são resolvidos em novos combates apenas entre os ainda empatados. Essas são políticas iniciais de protótipo explicitadas no plano.

A implementação preserva o limite de 240 comandos de quiz por minuto, acrescenta orçamento de controles de 30 por segundo, permite grupos/zero sobreviventes nos estados apropriados e prepara perguntas de sobrevivência por lote. Nenhuma dependência da VM foi necessária. O servidor valida o quadro comum uma vez e só retoma a seleção de conteúdo quando necessário, evitando reconstruir o catálogo em cada passo de movimento.

## Entregáveis

- [x] Criar domínio autoritativo de combate no servidor, separado do quiz e das estratégias de pontos, com identidades e grupos congelados por desempate.
- [x] Criar estados de preparação, combate, pergunta de sobrevivência, retorno com uma vida, eliminação, resultado e interrupção; integrar seu ciclo à sala e à final.
- [x] Adicionar contratos validados para comandos de movimento/tiro, projeções do combate, pergunta e resposta, preservando gabarito privado até a resolução.
- [x] Detectar um grupo eliminado simultaneamente em uma resolução atômica de T23 e iniciar apenas um desempate para esse grupo.
- [x] Implementar três vidas iniciais por participante; aplicar dano e pergunta ao chegar a zero, sem vida negativa, perguntas duplicadas ou acerto restaurando as três vidas iniciais.
- [x] Usar o seletor privado de perguntas aprovadas; manter o ineditismo em toda a partida, inclusive quiz, final e desempates, e revisar reserva/demanda de conteúdo.
- [x] Implementar arena 2D top-down responsiva, controles para computador e toque, HUD com vidas, pergunta, retorno ao combate e visualização por espectadores.
- [x] Congelar uma única resposta por pergunta de sobrevivência; validar autor/contexto/prazo e preservar resultado em reconexões e repetições.
- [x] Integrar resultados do grupo ao pódio, histórico e revanche, preservando as colocações dos participantes fora do empate.
- [x] Integrar T36/T29/T32 e os sinais de som/narração conforme os novos estados, sem aplicar sons ou controles de tiro durante perguntas por engano.

## Critérios de aceite e verificação

- [x] Dois ou mais eliminados juntos entram no mesmo desempate; um eliminado sozinho não inicia o minigame.
- [x] Todos os ativos da final chegando a zero juntos seguem ao desempate; não há campeão decidido pelo primeiro evento processado.
- [x] Todos começam com três vidas; zero abre uma pergunta; erro elimina; acerto retorna com exatamente uma vida, inclusive em chegadas sucessivas a zero.
- [x] Concorrência entre tiros, dano e respostas, callbacks atrasados, pacotes repetidos e reconexões não duplicam perdas, perguntas, recuperações ou resultado.
- [x] Espectadores, eliminados e participantes fora do grupo não controlam combatentes nem respondem por outra pessoa; gabaritos não são enviados antecipadamente.
- [x] Resultado pode ser integrado ao pódio sem ordenar eliminações simultâneas por socket, identidade, anfitrião ou conexão.
- [x] Verificar serviço, contratos, rede e percurso real em desktop/celular emulado, com grupos de 2/4/12. A avaliação humana de conforto/controles fica na T32, com roteiro atualizado.
- [x] Revalidar duração da partida e orçamento de conteúdo; o acerto permite recuperações repetidas, portanto não presumir duração máxima ou número fixo de perguntas de sobrevivência.

## Cuidados de implementação

Continuar com servidor autoritativo e projeções por jogador. O cliente envia intenções; não declara acertos de tiro, dano, vidas, correção da pergunta ou campeão. Escolher transporte e frequência de atualização com base na infraestrutura existente e em medições do protótipo.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). A publicação continua por último, na T35, aguardando a VM do usuário.

## Evidências da implementação — 23/10/2026

- Domínio e serviço: combate autoritativo, colisões por segmento, dano por lote, perguntas privadas, acerto devolvendo uma vida, erro/ausência, recuperação repetida, novos subgrupos, reconexão e resultado aplicado à final.
- D02/D03/D06 aplicadas como base da integração: perda coletiva, sorteio entre todos os ativos e vidas iguais com posições sem saltos. Os testes antigos que esperavam pausas foram atualizados para o comportamento aprovado.
- `pnpm test`: 888 testes aprovados (475 servidor, 186 shared, 179 web, 43 conteúdo e 5 artes). Seis testes adicionais da fronteira pública de combate foram aprovados posteriormente, totalizando 894 verificações distintas.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` e formatação verificados; a evidência final de regressão e carga é completada abaixo.
- Playwright T39 inicial: desktop 34,0 s e celular emulado 35,7 s, com teclado/mouse e toque real do navegador; tiro, pergunta, acerto, recarga conservando prazo, nova perda, erro, pódio e revanche. Capturas foram inspecionadas.
- `pnpm questions:simulate:classic --check`: 120 sequências, 480 percursos, 1.260 configurações de temas e nenhuma repetição; relatório T36 preservado.
- `pnpm pilot:simulate`: 60 percursos concluídos, incluindo 2/4/8/12 participantes, comparações de parâmetros e casos de ausência/empate; novo [relatório T39](../../data/publication-reports/t39-group-pilot.json), preservando o relatório T32 anterior. Bots usam intenções oficiais de movimento/mira/tiro e não injetam impactos ou vencedor.
- Avaliação humana de equilíbrio, conforto e latência real permanece em T32; o roteiro inclui o minigame. Não houve commit, push, deploy ou criação de VM.

### Carga e otimização

O primeiro perfil ficou ligeiramente acima da meta de 25 ms no p95. A publicação passou a validar o quadro comum uma única vez, e `MatchService.apply` passou a retomar/checkpointar o seletor somente quando há operação de conteúdo. Passos de movimento mantêm o checkpoint isolado da transação, sem reconstruir catálogo nem remover as cópias que protegem commit/rollback. Após essa alteração, os 65 testes focados de serviço/combate passaram.

`pnpm tiebreak:benchmark` aprovado: três salas de doze, cinco minutos virtuais, 18.000 passos, **p95 22,285 ms**, 108.000 quadros de destinatário, tamanho máximo de 2.511 bytes, zero visões completas durante movimento e zero erros. No máximo seis timers simultâneos (partida e ciclo de vida por sala), nenhum restante após descarte. [Relatório e máquina de referência](../validation/t39-load.json). O cenário usa controles neutros para medir agendamento/transação/clonagem/publicação; tiro e perguntas são cobertos em domínio, serviço e navegador. Não representa medição de latência em rede externa.

### Regressão final e artefato

Oito percursos Playwright aprovados em **11,5 minutos**, sem retry: duas composições do modo clássico, final/revanche e desempate, cada um em desktop e celular emulado. T39 levou 33,2 s no desktop e 35,1 s no celular nessa matriz. Auditorias verificaram os eventos públicos, ausência de gabarito antecipado, ausência de dependências externas e largura da página. Capturas reais de arena desktop/celular foram inspecionadas; relatório e artefatos estão em `e2e/playwright-report/` e `e2e/test-results/`.

Após a otimização de seleção sob demanda, 65 testes focados de serviço/combate passaram; tipos, lint e formatação passaram novamente, e o build final foi gerado com o código otimizado. A suíte geral anterior mais os seis novos testes de fronteira totalizam 894 verificações distintas aprovadas. A reprodução integral do novo relatório com `pilot:simulate --check` e a CI hospedada não foram repetidas; o relatório foi gerado com sucesso e a reprodução determinística é coberta no teste focado de piloto. A aceitação humana continua na T32.
