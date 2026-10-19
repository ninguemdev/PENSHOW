# Motor comum da partida

A T14 implementa o motor interno em `apps/server/src/modules/matches/`. Ele compõe a seleção da T12 e os cálculos da T13 na fila existente da sala. A [T15](quiz-classico.md) instala o serviço e os handlers em `app.ts` somente em desenvolvimento/teste, com integração de sessões Socket.IO reais. A [T16](quiz-classico-web.md) conecta início e telas aos estados/comandos autoritativos. D01–D06 continuam em consulta.

## Estado e estratégia

`createMatch` copia o elenco, perfis, configurações e plano de fases; valida cada modalidade no `StrategyRegistry` e congela as regras experimentais do `matchId`. O agregado guarda revisão, placar e histórico de resoluções. A sala recusa mudanças no elenco, regras ou plano durante a mesma partida.

`transitionMatch` recebe estado, evento e instante explícitos e devolve novo estado e solicitações de conteúdo. Não lê relógio global, sorteia IDs, instala timers ou chama transporte. O registro fornece a resolução da modalidade por um contrato pequeno; somente `classicStrategy` é instalada pelo serviço. Não há implementação fictícia das outras modalidades nem da final.

O ciclo executável é:

```mermaid
stateDiagram-v2
  [*] --> Instrucoes
  Instrucoes --> Tema: todos prontos ou prazo
  Tema --> Leitura: escolha válida ou sorteio no prazo
  Leitura --> Respostas: abertura anunciada
  Respostas --> Revelacao: todos responderam ou prazo
  Revelacao --> Leitura: próxima pergunta
  Revelacao --> Resultado: perguntas concluídas
  Resultado --> Instrucoes: próxima estratégia registrada
  Resultado --> PrototipoConcluido: plano atual concluído
```

`awaiting-category` e `awaiting-question` são etapas intermediárias da transação. O serviço resolve seus efeitos antes de confirmar a sala; elas nunca são publicadas. `prototype-complete` encerra somente o plano experimental atual, sem produzir classificação, vidas ou vencedor. A interrupção por conteúdo insuficiente também termina sem vencedor.

O serviço prepara um plano clássico de seis perguntas, com três fáceis e três médias pelos parâmetros padrão. O motor puro aceita planos de estratégias registradas; o serviço só prepara o formato clássico nesta etapa. Apostas, alvos e turnos exclusivos terão suas próprias extensões nas tarefas correspondentes.

## Transação, prazos e falhas

`MatchSession` guarda o agregado e um `SelectionCheckpoint` privado em `RoomPhase`. `QuestionSelection.resume` clona o grafo do checkpoint, preservando os vínculos internos de mapas/conjuntos. Seleção, cursor de pergunta, respostas, resolução e placar são confirmados juntos por `Room.runExclusive`. Uma exceção descarta todo o rascunho; a fila continua aceitando operações.

Checkpoints são apenas memória interna confiável: não constituem formato público nem persistência para reinício. As portas de IDs e sorteio ficam fora do snapshot. Uma tentativa que falha pode consumir entropia/IDs, mas não consome conteúdo ou altera o estado confirmado.

O ator vem da autenticação. O serviço revalida conexão atual, papel e associação na execução da fila e mede o recebimento pelo relógio injetado nesse momento. A janela aceita `opensAt <= receivedAt < deadlineAt`; o prazo exato já está encerrado. Uma resposta por participante é definitiva. Repetir prontidão é uma operação sem alteração; respostas repetidas são rejeitadas e não reaplicam pontos.

A resolução consulta a estratégia uma vez ao fechar a pergunta e guarda placares anterior/atual e efeitos no mesmo commit. O histórico impede resolver novamente o mesmo `questionId`. Não há reaplicação independente dos efeitos de crédito: a projeção lê o placar já confirmado.

Depois do commit, `QuizLifecycle.committed` cancela o timer anterior e agenda o próximo antes de o observador publicar as visões. O timer inclui sala por referência, `matchId`, `roundId`, `questionId`, revisão, etapa e prazo. O callback entra novamente na fila e compara todo o contexto, inclusive sua identidade de agendamento. Cancelamento físico e checagem lógica protegem contra callbacks já em trânsito.

Presença/reconexão não renovam o timer da partida. O prazo de abertura anunciado na leitura continua sendo a origem da janela de resposta quando o callback atrasa; se a janela inteira já passou, a pergunta é resolvida por ausência. A revelação inclui `revealMs + transitionMs` antes da próxima leitura. Retorno ao lobby, fechamento e conclusão cancelam o timer de partida.

Falha de conteúdo/cálculo antes do commit mantém o estado anterior; um timer tenta o mesmo contexto novamente após um segundo, enquanto ainda for atual. Novos comandos válidos continuam na mesma fila. Falha do observador depois do commit é reportada sem desfazer o placar; o próximo timer já foi instalado. Esse tratamento pressupõe o funcionamento das portas de relógio/agendamento; não oferece recuperação após reinício do processo.

## Projeção e limite de rede

`buildMatchView` constrói campos permitidos e valida o resultado com `matchViewSchema`. Leitura contém apenas o enunciado; abertura contém alternativas, progresso e somente a escolha do próprio destinatário. Espectador recebe `ownAnswer: unavailable`. Gabarito, explicação e efeitos aparecem na revelação. Checkpoint, fontes, IDs editoriais, mapa de alternativas, recibos e perguntas futuras nunca são publicados.

`buildPlayerView` incorpora esse resultado quando a sala tem um motor instalado. Validadores legados sem agregado continuam retornando `null` na fase de partida. A publicação usa o observador existente, com versão única da sala após cada mutação aceita. `prototype-complete` é uma extensão aditiva da união pública `MatchStage`, com a última fase de pontuação e sem pódio.

`app.ts` compõe `MatchService({ runtime, questions, isCurrentActor })` fora de produção, fornece como `quiz` ao `RoomService` e mantém `onChange` com o publicador existente. `match.handlers.ts` encaminha ações autenticadas por `matches.execute(room, actor, command)` e adapta os acks específicos. O retorno público exige conclusão ou interrupção; o retorno interno do ciclo de salas conserva a possibilidade de cancelamento. A T15 também projeta contagens de fase/pergunta em `MatchView.progress`.

## Verificação

`match.domain.test.ts` cobre transições, imutabilidade, prontidão repetida, autorização/contexto, prazo exato, callbacks atrasados, todos responderam, ausência, efeitos em ordem, histórico único, interrupção, término e passagem para outra estratégia fornecida somente pelo teste.

`match.service.test.ts` usa salas reais em memória, catálogo sintético aprovado, seleção efetiva, relógio/agendador manuais e projeções validadas. Cobre seis perguntas distintas, concorrência, cancelamento no lobby/fechamento, callback de partida anterior, rollback após consumo de conteúdo, falha de cálculo, nova tentativa do timer, falha de publicação, conexão substituída e privacidade por destinatário. Evidências de execução estão na [T14](tasks/T14-motor-comum-de-partida.md).
