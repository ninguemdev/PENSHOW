# Regras em discussão

Este documento diferencia requisitos definidos e propostas. Nenhuma proposta numérica constitui uma decisão definitiva.

## Requisitos definidos

| ID | Requisito |
|---|---|
| R01 | Jogo multiplayer de navegador chamado PENSHOW |
| R02 | Reaproveitar arquitetura modular, salas, nomes e criação de personagem do Comicle |
| R03 | Perguntas separadas por temas e fases com regras diferentes |
| R04 | Usar Brain Show como referência da experiência |
| R05 | A colocação antes da final deve produzir vantagens de 4, 3, 2 e 1 perdas de vida, do primeiro ao restante |
| R06 | Definir e ajustar regras ao longo do desenvolvimento, com consulta sobre dúvidas relevantes |

R05 ainda precisa de esclarecimento: **ser eliminado na quarta perda** corresponde a quatro vidas; **poder perder quatro vezes e continuar** corresponde a cinco vidas. A tabela provisória de planejamento usa 4 / 3 / 2 / 1 vidas iniciais, sem implementar essa interpretação antes da resposta.

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

| Colocação acumulada | Vidas iniciais propostas |
|---|---:|
| 1º | 4 |
| 2º | 3 |
| 3º | 2 |
| 4º em diante | 1 |

- Converter a classificação uma única vez ao entrar na final; reconectar não recalcula vidas.
- Acertar, errar e receber ataques precisam de regra definida antes da implementação.
- Pergunta enviada: acerto permite atacar qualquer adversário, apenas quem errou, ou não há ataques?
- Pergunta enviada: os valores representam vidas iniciais ou perdas que o jogador consegue sobreviver?
- Decidir se erro e ataque podem causar duas perdas na mesma pergunta. Proposta para avaliar: no máximo uma perda por jogador por pergunta.
- Decidir se existe somente um atacante por pergunta ou se todo acerto concede ataque; isso altera drasticamente a duração de quatro vidas.
- Proposta: sem ganho de vidas durante a final, para a vantagem inicial permanecer compreensível.
- Proposta: acerto não causa dano a si mesmo; não se pode escolher alvo eliminado; vidas nunca ficam negativas.
- Proposta: último jogador com vida vence. Eliminados acompanham como espectadores.

## Empates, desconexões e prazos

Propostas a validar com a primeira partida:

1. Empate no placar antes da final: comparar acertos; persistindo empate em uma faixa que altere vidas, realizar perguntas extras somente entre empatados, até ordenar a faixa. Um limite e uma saída para empates persistentes precisam ser definidos.
2. Dano simultâneo que eliminaria todos: não declarar vencedor por ordem dos eventos; entrar em desempate entre os últimos envolvidos. A regra exata de retorno de vidas ou disputa isolada permanece pendente.
3. Resposta enviada dentro do prazo é definitiva. Repetir a mesma requisição devolve o resultado já aceito e não pontua novamente.
4. O servidor decide se o prazo acabou; a hora informada pelo cliente não determina a pontuação. Sincronizar apenas a exibição do cronômetro.
5. Queda mantém lugar, pontuação, resposta aceita e vidas. A pergunta continua com o prazo original; voltar não fornece tempo extra. Ausência na final segue a regra de erro que for aprovada.
6. Se o anfitrião cair, outro assume após carência. Ser anfitrião não dá acesso ao gabarito nem poder de alterar resultados.
7. Reinício do servidor encerra salas na primeira versão proposta. Retomada após reinício exige persistência de sessões, fase, prazos e ações; não é prometida pelo reaproveitamento do Comicle.
8. Só uma aba ativa controla a identidade. Reabrir sala com o mesmo token substitui a conexão anterior.
9. Se não houver perguntas inéditas e revisadas do tema, oferecer outros temas; não repetir silenciosamente nem consultar uma API durante a partida.

## Próximas decisões

Primeiro resolver vidas e ataques na final. Depois, durante os protótipos: direção visual, capacidade, duração, tema por votação ou rodízio, pontuação, dinamite, empates e penalidade de ausência. Perguntar por etapa, evitando fechar todas as regras antes de experimentar.
