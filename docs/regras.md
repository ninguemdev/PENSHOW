# Regras em discussão

Este documento diferencia requisitos definidos e propostas. Valores identificados como propostas continuam sujeitos a ajuste; os requisitos definidos e a distribuição de vidas da final foram confirmados.

O [plano detalhado do jogo](plano-do-jogo.md) contém as fichas completas das fases, fórmulas, tempos, exemplos de placar, estimativa de duração, interface e casos para validar no protótipo. Este documento resume os requisitos e os valores de trabalho desse plano.

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
| R09 | O modo clássico será o modo padrão, com cinco fases no total: quatro modalidades diferentes em ordem aleatória e a final obrigatoriamente na quinta posição |

Decisões confirmadas: os valores 4 / 3 / 2 / 1 representam perdas às quais se sobrevive. Por exemplo, o líder começa com cinco vidas: depois de quatro perdas ainda tem uma vida; a quinta perda o elimina. A final tem uma única tentativa por pergunta, disputada entre os jogadores; o primeiro a responder assume o risco de perder uma vida ou ganha o direito de atacar qualquer adversário ativo.

## Fluxo proposto

`Perfil → criar/entrar → lobby → instruções → escolher tema → perguntas → resultado da fase`.

No modo clássico, repetir por quatro modalidades diferentes sorteadas; depois `classificação → desempate se necessário → atribuição de vidas → final (fase 5) → pódio → revanche no lobby`. A [T36](tasks/T36-modo-classico-padrao.md) implementará esse fluxo. A proposta anterior de cinco fases fixas mais final foi substituída pelo pedido de 20/10/2026.

- De 2 a 12 participantes, acompanhando a capacidade do Comicle; confirmar no primeiro teste de grupo.
- Ninguém precisa criar uma conta. O anfitrião também joga.
- Perfil editável no lobby; identidade e perfil da partida ficam estáveis durante o jogo.
- Quem chega após o início observa e entra na próxima partida.
- Perguntas e instruções em pt-BR. Primeira versão com alternativas textuais.
- Proposta por modalidade sorteada: seis perguntas em quiz simples, velocidade, aposta e roubo; na pressão/dinamite, dois turnos por participante. A quinta fase é a final, até restar um jogador com vida. Cada pergunta tem três segundos de leitura; resposta de até 15 segundos nas modalidades simultâneas e na final, ou dez segundos na dinamite.
- Instruções de até 15 segundos, com avanço antecipado se todos os participantes conectados estiverem prontos; essa etapa não consome o prazo de resposta.
- Todos acumulam pontos até a final. Eliminação de uma fase não significa sair da partida.
- Escolha de tema: fila de participantes com ordem inicial sorteada, até quatro opções elegíveis e prazo de dez segundos; sorteio automático se ninguém escolher. Continuar a fila na revanche, para contemplar grupos com mais participantes que escolhas. Evitar perguntas repetidas na partida.
- Plano da T36 para o catálogo atual: sortear quatro entre quiz simples, velocidade, aposta, roubo e pressão/dinamite, sem reposição, e sortear a ordem. Uma modalidade fica de fora em cada partida. A final não participa do sorteio. A variante de pressão continua sujeita a D04.

## Modalidades propostas

As pontuações abaixo são hipóteses iniciais. A [T13 implementa seus parâmetros e cálculos puros](pontuacao-e-parametros.md); o [motor da T14](motor-de-partida.md) e o [quiz clássico da T15](quiz-classico.md) executam a primeira modalidade em desenvolvimento/teste. A implementação e os testes não transformam essas hipóteses em decisões confirmadas.

| Fase | Regra proposta | Pontos e prazo propostos |
|---|---|---|
| Quiz clássico | Todos escolhem uma de quatro alternativas, simultaneamente | Acerto +100; erro ou ausência 0; 15 s |
| Velocidade | Todos respondem, acerto recebe bônus por faixa de tempo | +100 de base; +50 nos primeiros 5 s; +25 até 10 s; +0 depois; erro 0 |
| Aposta | Tema e dificuldade conhecidos, aposta selada antes do enunciado | Apostar 0, 25 ou 50, coberto pelo saldo; acertar +100 e a aposta; errar ou não responder perde somente a aposta |
| Roubo | Todos respondem; primeiro acerto conquista o roubo nesta proposta | Todo acerto +100; primeiro acerto transfere até 50 de um adversário, com limite pelo saldo do alvo |
| Dinamite | Dois turnos por pessoa, com prazo individual completo | Acerto +300; erro ou ausência −150, limitado pelo saldo; dez segundos para cada resposta |

Para roubo, só revelar a primeira resposta correta depois de fechar as respostas de todos. Ela recebe seis segundos para escolher o alvo; sem escolha ou alvo com saldo, não há transferência. Calcular o saldo do alvo depois de aplicar o crédito de acerto. A pergunta sobre permitir roubo somente ao primeiro acerto ou também a outros foi enviada; o formato de primeiro acerto é provisório.

Para dinamite, uma pergunta média e uma difícil por participante. Sortear a ordem no primeiro ciclo e invertê-la no segundo. Acerto passa a dinamite; erro ou ausência causa explosão e penalidade, seguida de uma dinamite nova para o próximo turno. Não transportar tempo restante negativo. O formato de dinamite está em consulta junto das alternativas de destaque simultâneo e sequência de acertos.

Máximos individuais propostos por modalidade: 600 / 900 / 900 / 900 / 600 pontos. A soma de 3.900 corresponde ao orçamento anterior com as cinco modalidades; o modo clássico soma apenas as quatro sorteadas e deve ter orçamento/equilíbrio recalculados na T36/T32. O placar começa em zero e nunca fica negativo. Ver fórmulas e exemplos no [plano do jogo](plano-do-jogo.md).

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
- Consultas enviadas: pergunta sem resposta e acerto sem escolha de alvo. Propostas de trabalho: pular sem dano se ninguém responder; se quem acertou não escolher em seis segundos, atacar o adversário com mais vidas, sorteando entre empatados. Não são decisões confirmadas.
- Proposta: sem ganho de vidas durante a final, para a vantagem inicial permanecer compreensível.
- Proposta: acerto não causa dano a si mesmo; não se pode escolher alvo eliminado; vidas nunca ficam negativas.
- Proposta: último jogador com vida vence. Eliminados acompanham como espectadores.

## Empates, desconexões e prazos

Propostas a validar com a primeira partida:

1. Empate no placar antes da final: comparar número de acertos; persistindo empate, a proposta de trabalho é sortear a ordem entre empatados e exibir o resultado antes de distribuir vidas. Foi enviada consulta entre perguntas extras, sorteio ou vidas iguais; não tratar a proposta como aprovada nem usar ordem de conexão ou condição de anfitrião como critério.
2. Na final, respostas concorrentes passam pela fila da sala: a primeira válida fecha as tentativas antes de revelar o resultado. Rejeitar as demais sem dano. Uma única perda por pergunta respondida impede eliminações simultâneas de todos os participantes.
3. Resposta aceita dentro do prazo é definitiva. Nas fases iniciais, cada jogador responde conforme a modalidade; na final, há uma única resposta aceita entre todos. Repetir a mesma requisição devolve o resultado já aceito e não aplica pontos, dano ou direito de ataque novamente.
4. O servidor decide se o prazo acabou; a hora informada pelo cliente não determina a pontuação. Sincronizar apenas a exibição do cronômetro.
5. Queda mantém lugar, pontuação, aposta, turno, resposta aceita e vidas. A pergunta continua com o prazo original; voltar não fornece tempo extra. Na final, estar ausente não é uma resposta errada: ainda é possível sofrer ataque se tiver vidas. Prazo coletivo sem resposta segue a política em consulta.
6. Se o anfitrião cair, outro assume após carência. Ser anfitrião não dá acesso ao gabarito nem poder de alterar resultados.
7. Reinício do servidor encerra salas na primeira versão proposta. Retomada após reinício exige persistência de sessões, fase, prazos e ações; não é prometida pelo reaproveitamento do Comicle.
8. Só uma aba ativa controla a identidade. Reabrir sala com o mesmo token substitui a conexão anterior.
9. Se não houver perguntas inéditas e revisadas do tema, oferecer outros temas; não repetir silenciosamente nem consultar uma API durante a partida.

## Próximas decisões

A distribuição de vidas, a primeira resposta exclusiva, a perda por erro e o ataque a qualquer adversário ativo estão definidos. As seis consultas desta etapa tratam de duração, final sem resposta, alvo não escolhido, quinta fase, direito ao roubo e desempate de classificação. Até as respostas chegarem, os padrões correspondentes são propostas descritas no plano. Validar também o equilíbrio da dinamite antes de consolidar o protótipo.
