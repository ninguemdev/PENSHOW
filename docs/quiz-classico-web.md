# Quiz clássico na web

A T16 conecta o lobby ao quiz de teste da T15. A rota continua `sala/:code`: a tela muda somente quando `RoomView.state` e `MatchView.stage` recebidas do servidor mudam. Não há URL de pergunta/fase nem botão que avance uma etapa localmente. O formato exibido é **uma fase com seis perguntas**, sem anunciar a partida completa.

O anfitrião pode iniciar quando houver dois jogadores conectados, sessão online e fotografia atual da sala. O servidor continua validando conteúdo/permissão e disponibiliza esse protótipo apenas em desenvolvimento/teste. Preferências, convite e participantes continuam acessíveis; perfil e papéis da partida vêm da fotografia congelada.

## Telas e ações

| Etapa recebida | Interface |
|---|---|
| `instructions` | Regra, prazo, quantidade de prontos e botão de pronto para participantes |
| `category-selection` | Nome do responsável e temas oferecidos; somente ele pode escolher |
| `question-reading` | Enunciado, tema, dificuldade e prazo de abertura; nenhuma alternativa |
| `question-open` | Quatro botões nativos, envio imediato por clique/toque/Enter/Espaço, progresso e confirmação da própria resposta |
| `reveal` | Gabarito e explicação recebidos, acertos, pontos e efeitos reais por jogador |
| `round-results` | Placar e prazo; aguarda a conclusão do servidor |
| `prototype-complete` / `interrupted` | Resultado/motivo e retorno ao lobby apenas para o anfitrião, por comando remoto |

Desde a [T18](velocidade.md), o registro usa `CommonRound` para clássico e velocidade, compartilhando preparação, pergunta/revelação e placar. A [T19](aposta.md) reutiliza o mesmo componente e acrescenta `WagerSelection`, com saldo/opções individuais, confirmação e recuperação da aposta. A velocidade apresenta faixas/base/bônus/total; aposta apresenta valores apostados e saldos anterior/atual somente na revelação. Modalidade ainda sem renderizador mostra uma mensagem e conserva o placar, sem simular regras ou oferecer respostas.

`Scoreboard` exibe pontos e acertos recebidos. Variações são os `ScoreEffect` da revelação, com sinal e valor fornecidos; a UI não recalcula pontos, compara alternativas para pontuar ou mantém uma classificação oficial própria. O gabarito só é consultado no componente da revelação. As fixtures de perguntas/explicações dos testes não são importadas pelo aplicativo.

## Store, confirmação e reconexão

O [protótipo de roubo](roubo.md) também usa `CommonRound`, com `TheftTarget` depois de fechar as respostas. Só o primeiro acerto da proposta atual recebe botões de adversários elegíveis. A revelação apresenta autor, alvo, valor e decomposição do saldo. Escolha incerta fica bloqueada até recuperar uma fotografia; o cliente não calcula transferência ou dano de vidas.

O [protótipo de dinamite](dinamite.md) usa o mesmo ciclo comum, com dono/ciclo/turno e próximo jogador recebidos do servidor. Só o dono tem alternativas habilitadas; o contador considera uma resposta por turno. O cronômetro representa o pavio individual. A revelação mostra passagem ou explosão e o débito recebido, mantendo todos os participantes. D04 continua em consulta.

`match-store` recebe somente intents simples (`start`, `ready`, `chooseCategory`, `answer`, `returnToLobby`); monta contexto a partir da view atual e revalida fase, papel, opção, conexão, prontidão e prazo antes de emitir. Componentes não importam o transporte. Confirmação de comando não muda a fase, o placar ou o progresso; a fotografia do servidor faz isso.

Uma tentativa de resposta é registrada localmente antes da emissão. Cliques concorrentes ficam bloqueados. A UI distingue **enviando**, **registrada** e **confirmação ausente**. Um timeout/erro interno mantém a escolha bloqueada naquela conexão, inclusive ao sair e voltar à rota. Erro explícito de payload/permissão pode permitir correção, sem reenvio automático. O botão de recuperar verifica a sessão e reconecta para obter nova fotografia.

Feedback e operações em andamento são vinculados a conexão, sala, destinatário, partida, fase e pergunta. Um ack antigo não altera a nova pergunta nem sua mensagem. Depois da reconexão, `ownAnswer: submitted` conserva a resposta e desabilita todas as alternativas. Se a nova fotografia confirma `pending`, uma tentativa incerta da conexão anterior já não bloqueia uma escolha; a conexão antiga é revalidada pelo servidor.

`session-store.viewReady` fica falso ao cair/reconectar e só volta com uma visão autenticada aceita. Estar online antes dessa fotografia não libera os botões. `connectionEpoch` separa respostas e amostras de relógio de conexões anteriores. A remoção/fim de sessão continua sendo tratada pela store da sala, sem restaurar associação por navegar até uma URL.

Sair durante uma partida conserva a vaga e o placar no servidor. O diálogo explica essa ausência e a store pausa ações da fotografia anterior; ao voltar, o usuário pode recuperar a sala por nova conexão antes de responder. A saída no lobby e a remoção de espectadores mantêm o comportamento de associação encerrada.

## Tempo, teclado e celular

A sincronização `time:sync` usa a estimativa pelo ponto médio. Enquanto uma amostra válida não chega, `serverNow` oferece aproximação do relógio. Uma amostra atrasada de outra conexão é descartada. `useNow` compartilha o instante visual entre controles e cronômetro; ao chegar a zero, os botões são desabilitados e a tela aguarda uma view, sem revelar ou avançar por conta própria. O serviço permanece responsável pelo prazo oficial.

Cada troca de etapa/pergunta foca o título. Botões de alternativas são nativos e não exigem confirmação adicional; a alternativa enviada tem `aria-pressed`. Progresso, resultado de envio e avisos de conexão têm texto/estado acessível. O cronômetro anuncia apenas o encerramento. Enunciados, opções e nomes podem quebrar linha, sem HTML vindo de perguntas.

As alternativas passam para uma coluna no celular, com altura mínima de 56 px. O placar usa tabela semântica dentro de região com rolagem horizontal e foco por teclado, conservando as colunas sem transbordar a página. Os avatares públicos e textos de presença continuam disponíveis. Ajustes amplos de acessibilidade/acabamento permanecem na T30.

## Verificação

`match-store.test.ts` cobre envio único, concorrência, ack antigo, erro explícito/incerto, recuperação sem segunda tentativa consumida, contexto/papel/fase/prazo e relógio. `match-flow.test.tsx` usa eventos públicos e testes por papel/texto: teclado, revelação/efeitos, espectador, queda, espera de fotografia, cronômetro, modalidade ausente e seis perguntas em duas sessões com falha de envio.

A checagem inicial de navegador da T16 usou Chrome headless com dois contextos isolados, servidor real, catálogo publicado e tempos oficiais. Perfil, sessão e associação foram preparados por API/Socket.IO para concentrar a verificação no quiz: desktop de 1280 px por Enter e viewport de 360 px por toque emulado concluíram seis perguntas distintas, mostraram **600/0** e retornaram ao lobby. A largura da página foi conferida e capturas foram inspecionadas. Evidências dessa execução estão na [T16](tasks/T16-quiz-classico-web.md). O [smoke permanente da T17](smoke-m2.md) prepara perfil/criação/convite pela interface, exercita acerto/erro/ausência e recargas e confirma **500/200** em desktop e celular emulado; também configura sua execução na CI.
