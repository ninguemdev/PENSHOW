# Seleção privada de temas e perguntas

A T12 implementa o módulo privado `apps/server/src/modules/questions/question-selection.ts`. Ele prepara o conteúdo de uma partida a partir de `QuestionRepository`, com `RandomSource`, `IdGenerator` e instantes explícitos. O catálogo é lido uma vez e validado como aprovado em pt-BR; todas as operações seguintes usam o snapshot em memória, sem HTTP, arquivos ou API externa.

O [motor da T14](motor-de-partida.md) compõe o módulo na fila da sala, com checkpoints privados para rollback de seleção e pontuação. O seletor não instala timers nem executa vidas ou turnos de participantes. A [T15](quiz-classico.md) conecta os comandos de partida em desenvolvimento/teste; o início na web pertence à T16. Os valores de conteúdo abaixo são os **orçamentos experimentais do plano**; não confirmam as decisões D01–D06. A [T13 centraliza os parâmetros e os cálculos puros de pontuação](pontuacao-e-parametros.md); `SELECTION_PROPOSAL` é uma adaptação dos padrões dessa configuração, sem repetir os números no seletor.

## Formatos e estoque

`QuestionSelection.create(repository, { ids, random }, options)` recebe `matchId`, participantes congelados, temas habilitados e um formato explícito. Aceita de dois a doze participantes, com IDs únicos, e de um a 32 temas distintos. Opcionalmente recebe a fila anterior da sala, grupos de IDs editorialmente equivalentes e as regras congeladas em `rules`. Sem esse argumento, congela os padrões da T13 para a identidade recebida. `categoryChoiceMs` continua disponível para protótipos isolados, mas não pode divergir de `rules` explícito.

| Formato | Conteúdo exigido |
|---|---|
| `classic-prototype` | Uma fase clássica: três fáceis e três médias em um tema; sem reserva de final |
| `full-prototype` | As cinco fases propostas, mais 25 fáceis e 25 médias protegidas para a final |

| Fase | Fáceis | Médias | Difíceis |
|---|---:|---:|---:|
| Clássica | 3 | 3 | 0 |
| Velocidade | 2 | 3 | 1 |
| Aposta | 2 | 2 | 2 |
| Roubo | 2 | 2 | 2 |
| Dinamite, N pessoas | 0 | N | N |

O total de perguntas não basta para autorizar um formato. A busca de alocação verifica cada fase inteira em um único tema, por dificuldade. No formato completo, calcula uma alocação viável das cinco fases e reserva 50 perguntas a partir do excedente dessa alocação. Não congela antecipadamente os temas escolhidos pelos participantes: ao abrir cada fase, só oferece temas cujo consumo ainda permite abastecer todas as fases restantes. A verificação considera estoque deduplicado e já desconta a reserva e as perguntas alocadas.

A busca usa primeiro a fase com menos temas possíveis, elimina tentativas simétricas e memoriza impasses. Foi comparada à enumeração de todas as distribuições em 150 cenários pequenos. Não converte uma dificuldade em outra para completar quantidade.

Quando o catálogo não cobre o formato, a criação retorna `{ status: "blocked", reason: "insufficient-content", message }`. Com as 72 perguntas da T11, o clássico ficava disponível nos seis temas e o formato completo era recusado. A [T27](revisao-editorial-t27.md) publica 300 perguntas e verifica o orçamento completo com 2–12 pessoas: cada subconjunto de três a seis temas permite a admissão; um ou dois temas não cobrem as dificuldades e a reserva. Os 50 reservados não são uma exigência para os protótipos de fase isolada.

## Escolha e prazo

`openRound(roundId, mode, now)` abre a escolha com até quatro temas elegíveis, sem repetir o tema anterior quando houver alternativa viável. A ordem dos temas é sorteada. A ordem de fases do orçamento completo é fixa; não permite abrir outra antes de concluir a atual. Reabrir o mesmo ID de fase devolve o estado existente e conserva as opções e o prazo.

A fila inicial é sorteada a partir de IDs ordenados, de modo que o sorteio não depende da entrada na sala, do anfitrião ou do placar. Seu estado contém `pending` e `served`. Escolha aceita ou expiração conta como uma oportunidade; nenhuma pessoa repete antes de todas as demais terem tido a vez.

`chooseCategory(roundId, playerId, category, now)` exige o participante da vez e um tema oferecido. O prazo experimental é de dez segundos, substituível por `categoryChoiceMs`. A escolha é recusada exatamente no prazo final. `expireCategoryChoice(roundId, now)` só age a partir desse instante e sorteia entre as opções já oferecidas; chamada antecipada, repetida ou de outra fase é ignorada. O método não instala um agendador.

`choiceQueueForRematch()` devolve uma cópia para o dono da sala guardar. A próxima criação recebe `previousChoiceQueue`: conserva pendentes e atendidos, remove quem saiu e inclui recém-chegados entre os pendentes antes de repetir os atendidos. Com oito pessoas e cinco escolhas numa partida, as três ainda pendentes escolhem primeiro na revanche. O histórico de perguntas recomeça na nova partida; a fila de pessoas continua.

## Deduplicação e perguntas estáveis

O seletor valida e ordena os registros por ID. IDs repetidos são erro. Enunciados equivalentes após normalizar acentos, caixa e pontuação são unidos. `equivalentQuestionIds` permite declarar grupos editoriais de paráfrases com enunciados diferentes; todos os IDs devem existir, e os grupos podem se sobrepor. Equivalência semântica é uma decisão editorial explícita, sem detecção por similaridade ou chamadas a modelos durante o jogo. O lote da T11 não tem grupos adicionais identificados.

Cada componente de equivalência mantém apenas o registro de menor ID em ordem de código entre os elegíveis ao tipo e aos temas habilitados, incluindo sua classificação de tema/dificuldade; isso evita contar uma paráfrase duas vezes, inclusive entre fontes ou temas. Uma variante booleana ou de tema desabilitado não elimina uma versão elegível. A revisão deve manter a classificação coerente e fornecer os grupos. Outra variante classificada em um segundo tema habilitado não aumenta o estoque desse segundo tema. A publicação continua recusando duplicatas literais; a defesa do seletor também cobre repositórios injetados.

Os formatos atuais usam perguntas múltiplas de quatro alternativas, conforme o plano. Registros booleanos podem existir no catálogo editorial, mas não completam esse estoque e não são convertidos em perguntas de quatro alternativas. Depois da escolha, todas as perguntas da fase são alocadas sem reposição. `currentQuestion(roundId)` prepara somente a pergunta atual, com alternativas embaralhadas e UUIDs públicos gerados pela porta de IDs. A preparação constrói explicitamente `PublicQuestion` e guarda um mapa privado entre opções públicas e editoriais, além do gabarito e da explicação.

Reconsultar, reconectar ou reabrir a fase não gera outros IDs, outra ordem de alternativas ou outro enunciado. Os retornos são cópias, incluindo o mapa privado. `advanceQuestion(roundId, expectedQuestionId)` só avança a pergunta esperada; repetir o avanço de uma já concluída não pula a seguinte. A fase só termina depois de consumir sua alocação. Na dinamite, os ciclos seguem `rules.parameters.pressure.turnDifficulties`: no padrão, N médias precedem N difíceis; atribuir os donos e inverter sua ordem no segundo ciclo pertence à T21.

`PreparedQuestion`, `history()` e `availability()` são internos do servidor. O histórico conta perguntas efetivamente preparadas; as demais já alocadas também ficam indisponíveis, embora ainda não exibidas. Antes da revelação, o motor só pode projetar `publicQuestion` ou seus metadados permitidos para aquela etapa. Não serializar a instância de seleção ou o mapa privado. A implementação de produção das portas usa `randomUUID` e `randomInt`; o seletor recusa IDs inválidos, editoriais ou repetidos, mas não certifica a entropia de uma porta injetada.

## Final e esgotamento

A reserva é distribuída pelos temas habilitados, privilegiando os que receberam menos itens, dentro do excedente disponível por dificuldade. A divisão pode ficar desigual quando o estoque exige preservar categorias específicas para fases anteriores. Perguntas reservadas ficam fora das opções e alocações dessas fases.

`startFinal(roundId)` exige a conclusão das cinco fases do orçamento completo. `currentFinalQuestion` alterna fácil/média e usa primeiro as 50 reservadas. Dentro dos temas com pergunta disponível na dificuldade da vez, prioriza os ainda não usados no ciclo e os menos exibidos; só reinicia o ciclo quando nenhum tema elegível ainda está pendente. Com estoque equilibrado, todos os temas aparecem antes da repetição. Um tema sem a dificuldade atual não é elegível naquele passo.

Ao terminar a reserva, busca perguntas inéditas do snapshot que não foram alocadas anteriormente. Continua alternando fácil/média; não usa difíceis como substituição. Pergunta atual e avanço têm as mesmas garantias de estabilidade e idempotência das outras fases. Uma reserva finita não garante conteúdo para qualquer duração da final.

Sem conteúdo elegível, retorna `ContentInterruption`, com `status: "interrupted"`, `reason: "content-exhausted"`, mensagem em pt-BR e `returnToLobby: true`. Não retorna campeão ou classificação inventados. A interrupção é terminal para essa instância; o motor deverá traduzi-la para a etapa pública de interrupção e oferecer retorno ao lobby. Se houver tema alternativo viável na abertura de fase, ele é oferecido antes de se chegar à interrupção.

## Integração com o motor

`MatchService` da T14 mantém o checkpoint por `matchId` dentro da sala. Cada transação retoma uma cópia privada, executa a seleção e confirma o checkpoint junto ao estado de partida; uma falha descarta ambos. O snapshot mantém vínculos internos de mapas/conjuntos, sem incluir as portas de IDs/sorteio e sem se tornar formato de persistência. Timers, autenticação, pontuação e projeções ficam nas camadas correspondentes. A T15 conecta os comandos de rede em desenvolvimento/teste; conservar a fila de escolha entre partidas pertence à revanche.

As verificações estão em `question-selection.test.ts`, com fixtures sintéticas e sorteio determinístico, e nas [evidências da T12](tasks/T12-selecao-de-temas-e-perguntas.md). Nenhum candidato, registro revisado, catálogo publicado ou contrato público foi modificado pela seleção.
