# Regras em discussão

Este documento diferencia requisitos definidos e propostas. Valores identificados como propostas continuam sujeitos a ajuste; os requisitos definidos e a distribuição de vidas da final foram confirmados.

## Requisitos definidos

| ID | Requisito |
|---|---|
| R01 | Jogo multiplayer de navegador chamado PENSHOW |
| R02 | Reaproveitar arquitetura modular, salas, nomes e criação de personagem do Comicle |
| R03 | Perguntas separadas por temas e fases com regras diferentes |
| R04 | Usar Brain Show como referência da experiência |
| R05 | O 1º deve sobreviver a 4 perdas de vida; o 2º, a 3; o 3º, a 2; os demais, a 1. As vidas iniciais são 5 / 4 / 3 / 2; a perda seguinte elimina |
| R06 | Definir e ajustar regras ao longo do desenvolvimento, com consulta sobre dúvidas relevantes |
| R07 | Na final, somente a primeira resposta de cada pergunta é avaliada. Se acertar, o jogador escolhe qualquer adversário ainda na disputa para tirar uma vida |
| R08 | Se a primeira resposta da final estiver errada, quem respondeu perde uma vida. Não há outra tentativa naquela pergunta; a disputa segue com uma nova pergunta após a resolução |

Decisões confirmadas: os valores 4 / 3 / 2 / 1 representam perdas às quais se sobrevive. Por exemplo, o líder começa com cinco vidas: depois de quatro perdas ainda tem uma vida; a quinta perda o elimina. A final tem uma única tentativa por pergunta, disputada entre os jogadores; o primeiro a responder assume o risco de perder uma vida ou ganha o direito de atacar qualquer adversário ativo.

## Fluxo proposto

`Perfil → criar/entrar → lobby → instruções → escolher tema → perguntas → resultado da fase`.

Repetir por cinco fases; depois `classificação → desempate se necessário → atribuição de vidas → final → pódio → revanche no lobby`.

- De 2 a 12 participantes, acompanhando a capacidade do Comicle; confirmar no primeiro teste de grupo.
- Ninguém precisa criar uma conta. O anfitrião também joga.
- Perfil editável no lobby; identidade e perfil da partida ficam estáveis durante o jogo.
- Quem chega após o início observa e entra na próxima partida.
- Perguntas e instruções em pt-BR. Primeira versão com alternativas textuais.
- Proposta de seis perguntas por fase, com prazo de 15 segundos por pergunta e instruções sem cronômetro de resposta. Esses valores serão ajustados em teste.
- Todos acumulam pontos até a final. Eliminação de uma fase não significa sair da partida.
- Escolha de tema: rodízio de participantes, quatro opções disponíveis; sorteio inicial e escolha automática se o prazo acabar. Evitar perguntas repetidas na partida.
- Cinco modalidades fixas na primeira versão; depois permitir ao anfitrião sortear cinco modalidades distintas de um catálogo maior.

## Modalidades propostas

As pontuações abaixo são hipóteses iniciais, ainda sem código de partida.

| Fase | Regra proposta | Pontos e prazo propostos |
|---|---|---|
| Quiz clássico | Todos escolhem uma de quatro alternativas, simultaneamente | Acerto +100; erro ou ausência 0; 15 s |
| Velocidade | Todos respondem, acerto recebe bônus por faixa de tempo | +100 de base; +50 nos primeiros 5 s; +25 até 10 s; +0 depois; erro 0 |
| Aposta | Tema conhecido, aposta selada antes do enunciado | Apostar de 0 até o menor entre 100 e o saldo; acertar +100 e a aposta; errar perde somente a aposta |
| Roubo | Quem acertou escolhe um alvo depois da revelação | Acerto +100; transferência de até 50 do saldo do alvo; resolver transferências simultaneamente e com limite pelo saldo disponível |
| Pressão | Turnos; acertar passa o objeto ao próximo jogador | Acerto +100; erro encerra o próprio turno sem pontos; cada novo turno recebe prazo completo; duração e penalidade do objeto a decidir |

Para roubo, escolhas ficam seladas até todos escolherem ou o prazo acabar. Se vários escolherem o mesmo alvo e faltar saldo, repartir proporcionalmente, com sobra distribuída por critério determinístico documentado. Evitar que a ordem de chegada dos comandos favoreça alguém. Validar a complexidade desta regra com o usuário antes de implementar.

Para pressão, não transportar tempo restante negativo ao próximo jogador. A proposta está incompleta de propósito: definir condição da explosão, penalidade e encerramento antes da implementação.

Alternativas de expansão: duas opções (+100 por acerto), sequência (bônus crescente com teto) e sobrevivência (três erros encerram apenas aquela fase). Não tratar uma pergunta de quatro alternativas como verdadeiro/falso sem revisar a transformação e o equilíbrio.

## Final

Distribuição confirmada:

| Colocação acumulada | Vidas iniciais | Perdas às quais sobrevive | Perda que elimina |
|---|---:|---:|---:|
| 1º | 5 | 4 | 5ª |
| 2º | 4 | 3 | 4ª |
| 3º | 3 | 2 | 3ª |
| 4º em diante | 2 | 1 | 2ª |

- Converter a classificação uma única vez ao entrar na final; reconectar não recalcula vidas.
- Confirmado: todos os jogadores ativos disputam a primeira resposta; somente ela é avaliada, mesmo se estiver errada. Não há repasse da mesma pergunta a outro participante.
- Confirmado: se a primeira resposta estiver errada, quem respondeu perde uma vida; os demais não sofrem dano por aquela resposta.
- Confirmado: se estiver certa, somente esse jogador escolhe qualquer adversário ainda ativo como alvo e retira uma vida dele. Os demais não precisam responder à pergunta.
- A primeira resposta aceita fecha imediatamente as tentativas daquela pergunta. Depois do erro ou do ataque, resolver a eliminação e abrir uma nova pergunta, caso a disputa continue.
- Cada pergunta respondida causa uma única perda de vida: de quem errou ou do alvo escolhido por quem acertou. Não há múltiplos ataques nem soma de erro e ataque na mesma pergunta.
- O servidor decide qual resposta válida chegou primeiro, dentro da fila da sala, e registra o vencedor da disputa antes de avaliar o gabarito. Payloads inválidos, espectadores, eliminados e respostas fora do prazo não ocupam essa oportunidade.
- Ainda definir: o que acontece se ninguém responder até o prazo e o que fazer se quem acertou não escolher um alvo ou desconectar antes do ataque.
- Proposta: sem ganho de vidas durante a final, para a vantagem inicial permanecer compreensível.
- Proposta: acerto não causa dano a si mesmo; não se pode escolher alvo eliminado; vidas nunca ficam negativas.
- Proposta: último jogador com vida vence. Eliminados acompanham como espectadores.

## Empates, desconexões e prazos

Propostas a validar com a primeira partida:

1. Empate no placar antes da final: comparar acertos; persistindo empate em uma faixa que altere vidas, realizar perguntas extras somente entre empatados, até ordenar a faixa. Um limite e uma saída para empates persistentes precisam ser definidos.
2. Na final, respostas concorrentes passam pela fila da sala: a primeira válida fecha as tentativas antes de revelar o resultado. Rejeitar as demais sem dano. Uma única perda por pergunta respondida impede eliminações simultâneas de todos os participantes.
3. Resposta aceita dentro do prazo é definitiva. Nas fases iniciais, cada jogador responde conforme a modalidade; na final, há uma única resposta aceita entre todos. Repetir a mesma requisição devolve o resultado já aceito e não aplica pontos, dano ou direito de ataque novamente.
4. O servidor decide se o prazo acabou; a hora informada pelo cliente não determina a pontuação. Sincronizar apenas a exibição do cronômetro.
5. Queda mantém lugar, pontuação, resposta aceita e vidas. A pergunta continua com o prazo original; voltar não fornece tempo extra. Ausência na final segue a regra de erro que for aprovada.
6. Se o anfitrião cair, outro assume após carência. Ser anfitrião não dá acesso ao gabarito nem poder de alterar resultados.
7. Reinício do servidor encerra salas na primeira versão proposta. Retomada após reinício exige persistência de sessões, fase, prazos e ações; não é prometida pelo reaproveitamento do Comicle.
8. Só uma aba ativa controla a identidade. Reabrir sala com o mesmo token substitui a conexão anterior.
9. Se não houver perguntas inéditas e revisadas do tema, oferecer outros temas; não repetir silenciosamente nem consultar uma API durante a partida.

## Próximas decisões

A distribuição de vidas, a primeira resposta exclusiva, a perda por erro e o ataque a qualquer adversário ativo estão definidos. Antes de implementar a final, resolver prazo sem resposta, prazo e desistência na escolha do alvo, e desempates de classificação antes da conversão em vidas. Durante os protótipos: direção visual, capacidade, duração, tema por votação ou rodízio, pontuação e dinamite. Perguntar por etapa, evitando fechar todas as regras antes de experimentar.
