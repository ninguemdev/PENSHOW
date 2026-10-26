# Regras do PENSHOW

Este documento diferencia requisitos definidos e propostas. As respostas de D01–D08 foram registradas em **23/10/2026** em [decisões](decisoes.md). As regras aprovadas abaixo ainda precisam ser aplicadas e verificadas no código; evidências anteriores descrevem o protótipo daquela data.

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
| R10 | Se ninguém responder à pergunta da final no prazo, todos os participantes ainda ativos perdem uma vida |
| R11 | Se quem acertou não escolher alvo em seis segundos, sortear entre todos os participantes ainda ativos, incluindo quem acertou |
| R12 | No roubo, todos os acertos valem +100; somente o primeiro acerto pode transferir até 100 pontos de um adversário, limitado ao saldo dele |
| R13 | Empatados em pontos e acertos antes da final compartilham colocação e vidas; contar posições por grupo, sem saltos: 1º grupo com 5 vidas, 2º com 4, 3º com 3 e demais com 2 |
| R14 | A modalidade de pressão usa dinamite por turnos, dois por participante, com prazo individual completo |
| R15 | Empatados por eliminação simultânea disputam um minigame de tiro 2D top-down, com 3 vidas iniciais cada; ao chegar a zero, recebem uma pergunta: erro elimina, acerto concede 1 vida |

Decisões confirmadas: os valores 4 / 3 / 2 / 1 representam perdas às quais se sobrevive. Por exemplo, o líder começa com cinco vidas: depois de quatro perdas ainda tem uma vida; a quinta perda o elimina. A final tem uma única tentativa por pergunta, disputada entre os jogadores; o primeiro a responder assume o risco de perder uma vida ou ganha o direito de atacar qualquer adversário ativo.

## Fluxo proposto

`Perfil → criar/entrar → lobby → instruções → escolher tema → perguntas → resultado da fase`.

No modo clássico, repetir por quatro modalidades diferentes sorteadas; depois `classificação com posições compartilhadas → atribuição de vidas → final (fase 5) → minigame se houver eliminação simultânea → pódio → revanche no lobby`. O minigame é um desempate dentro da final, sem alterar as cinco fases totais. A [T36](tasks/T36-modo-classico-padrao.md) integra o fluxo e a [T39](tasks/T39-desempate-tiro-top-down.md) acrescentará o desempate. A proposta anterior de cinco fases fixas mais final foi substituída pelo pedido de 20/10/2026.

- De 2 a 12 participantes, acompanhando a capacidade do Comicle; confirmar no primeiro teste de grupo.
- Ninguém precisa criar uma conta. O anfitrião também joga.
- Perfil editável no lobby; identidade e perfil da partida ficam estáveis durante o jogo.
- Quem chega após o início observa e entra na próxima partida.
- Perguntas e instruções em pt-BR. Primeira versão com alternativas textuais.
- Proposta por modalidade sorteada: seis perguntas em quiz simples, velocidade, aposta e roubo; na pressão/dinamite, dois turnos por participante. A quinta fase é a final, até restar um jogador com vida. Cada pergunta tem três segundos de leitura; resposta de até 15 segundos nas modalidades simultâneas e na final, ou dez segundos na dinamite.
- Instruções de até 15 segundos, com avanço antecipado se todos os participantes conectados estiverem prontos; essa etapa não consome o prazo de resposta.
- Todos acumulam pontos até a final. Eliminação de uma fase não significa sair da partida.
- Escolha de tema: fila de participantes com ordem inicial sorteada, até quatro opções elegíveis e prazo de dez segundos; sorteio automático se ninguém escolher. Continuar a fila na revanche, para contemplar grupos com mais participantes que escolhas. Evitar perguntas repetidas na partida.
- Plano da T36 para o catálogo atual: sortear quatro entre quiz simples, velocidade, aposta, roubo e pressão/dinamite, sem reposição, e sortear a ordem. Uma modalidade fica de fora em cada partida. A final não participa do sorteio. A variante de dinamite foi confirmada em D04.
- Meta de duração aprovada em D01: 20 a 30 minutos para 4 a 8 pessoas; validar em partidas humanas, sem impor encerramento artificial à final.

## Modalidades propostas

As pontuações abaixo continuam sujeitas à avaliação de equilíbrio, exceto o roubo de até 100 e a base de +100 por acerto, confirmados em D05. A [T13 implementa parâmetros e cálculos puros](pontuacao-e-parametros.md); o teto de 100 está aplicado na T20. D04 confirma o formato da dinamite; testes mecânicos não substituem avaliação humana dos demais valores.

| Fase | Regra proposta | Pontos e prazo propostos |
|---|---|---|
| Quiz clássico | Todos escolhem uma de quatro alternativas, simultaneamente | Acerto +100; erro ou ausência 0; 15 s |
| Velocidade | Todos respondem, acerto recebe bônus por faixa de tempo | +100 de base; +50 nos primeiros 5 s; +25 até 10 s; +0 depois; erro 0 |
| Aposta | Tema e dificuldade conhecidos, aposta selada antes do enunciado | Apostar 0, 25 ou 50, coberto pelo saldo; acertar +100 e a aposta; errar ou não responder perde somente a aposta |
| Roubo | Todos respondem; somente o primeiro acerto conquista o roubo, conforme D05 | Todo acerto +100; primeiro acerto transfere até 100 de um adversário, com limite pelo saldo do alvo |
| Dinamite | Dois turnos por pessoa, com prazo individual completo | Acerto +300; erro ou ausência −150, limitado pelo saldo; dez segundos para cada resposta |

Para roubo, só revelar a primeira resposta correta depois de fechar as respostas de todos. Ela recebe seis segundos para escolher o alvo; sem escolha ou alvo com saldo, não há transferência. Calcular o saldo do alvo depois de aplicar o crédito de acerto. D05 confirma o direito exclusivo do primeiro acerto e o teto de 100; não aplicar ao roubo o sorteio automático da final.

Para dinamite, uma pergunta média e uma difícil por participante. Sortear a ordem no primeiro ciclo e invertê-la no segundo. Acerto passa a dinamite; erro ou ausência causa explosão e penalidade, seguida de uma dinamite nova para o próximo turno. Não transportar tempo restante negativo. D04 confirma dois turnos por participante e prazo individual completo.

Máximos individuais por modalidade, usando os parâmetros atuais e o teto aprovado de roubo: 600 / 900 / 900 / 1.200 / 600 pontos. O máximo do roubo pressupõe seis acertos com seis transferências integrais, dependentes do saldo dos adversários. O modo clássico soma apenas as quatro modalidades sorteadas; recalcular o equilíbrio em T32/T36. O placar começa em zero e nunca fica negativo. Ver fórmulas e exemplos no [plano do jogo](plano-do-jogo.md).

Alternativas de expansão: duas opções (+100 por acerto), sequência (bônus crescente com teto) e sobrevivência (três erros encerram apenas aquela fase). Não tratar uma pergunta de quatro alternativas como verdadeiro/falso sem revisar a transformação e o equilíbrio.

## Final

Distribuição confirmada:

As colocações abaixo contam **grupos de pontuação e acertos**, sem pular posições quando há empate. Exemplo: Ana e Beto empatados em 1º recebem cinco vidas cada; Carla, no próximo grupo, fica em 2º com quatro; o grupo seguinte recebe três. Se todos empatarem, todos recebem cinco vidas.

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
- Confirmado em D02: se ninguém responder no prazo, todos os participantes ainda ativos perdem uma vida, inclusive os desconectados. Eliminados não recebem novo dano.
- Confirmado em D03: se quem acertou não escolher alvo em seis segundos, sortear entre todos os participantes ainda ativos, inclusive o próprio autor do acerto e os desconectados. Cada elegível tem a mesma chance; não priorizar quem tem mais vidas. Registrar o resultado uma única vez, sem novo sorteio na reconexão ou em callbacks repetidos.
- No quiz da final, não há ganho de vidas. O minigame de desempate tem vidas separadas e permite recuperar uma vida ao acertar a pergunta de sobrevivência.
- A escolha manual não permite atacar a si mesmo; o sorteio automático de D03 pode atingir quem acertou. Não se pode atingir eliminado; vidas nunca ficam negativas.
- Proposta: último jogador com vida vence. Eliminados acompanham como espectadores. Havendo eliminação simultânea de mais de um participante, os empatados disputam o minigame de D09 para resolver suas colocações, inclusive se todos os ativos chegarem a zero juntos.

## Minigame de desempate — D09

- Apenas os participantes empatados pela mesma eliminação simultânea entram no combate de tiro **2D top-down**.
- Cada participante começa com **3 vidas**, próprias do minigame.
- Quando as vidas de um participante chegam a **zero**, ele recebe uma pergunta.
- Se **errar**, morre e é eliminado do minigame. Se **acertar**, ganha **1 vida** e continua; a regra vale a cada nova chegada a zero.
- O combate desempata o grupo eliminado na final; não é uma disputa para quem apenas perdeu uma vida e continua com vidas no quiz.
- A [T39](tasks/T39-desempate-tiro-top-down.md) registra implementação e evidências; o [guia](desempate-tiro.md) explica o comportamento entregue em desenvolvimento/teste.

## Empates, desconexões e prazos

Propostas a validar com a primeira partida:

1. Empate no placar antes da final: comparar número de acertos; persistindo empate, atribuir a mesma colocação e vidas ao grupo, conforme D06, sem sorteio ou perguntas extras. Contar grupos consecutivamente: 5 / 4 / 3 / 2 vidas, sem pular faixa pelo tamanho do grupo. Não usar ordem de conexão ou condição de anfitrião como critério.
2. Na final, respostas concorrentes passam pela fila da sala: a primeira válida fecha as tentativas antes de revelar o resultado. Rejeitar as demais sem dano. Uma pergunta respondida causa uma perda; uma pergunta sem resposta causa a perda coletiva de D02 e pode produzir eliminações simultâneas.
3. Resposta aceita dentro do prazo é definitiva. Nas fases iniciais, cada jogador responde conforme a modalidade; na final, há uma única resposta aceita entre todos. Repetir a mesma requisição devolve o resultado já aceito e não aplica pontos, dano ou direito de ataque novamente.
4. O servidor decide se o prazo acabou; a hora informada pelo cliente não determina a pontuação. Sincronizar apenas a exibição do cronômetro.
5. Queda mantém lugar, pontuação, aposta, turno, resposta aceita e vidas. A pergunta continua com o prazo original; voltar não fornece tempo extra. Na final, estar ausente não é uma resposta errada: ainda é possível sofrer ataque ou ser sorteado se tiver vidas. Se ninguém responder no prazo, aplica-se a perda coletiva de D02.
6. Se o anfitrião cair, outro assume após carência. Ser anfitrião não dá acesso ao gabarito nem poder de alterar resultados.
7. Reinício do servidor encerra salas na primeira versão proposta. Retomada após reinício exige persistência de sessões, fase, prazos e ações; não é prometida pelo reaproveitamento do Comicle.
8. Só uma aba ativa controla a identidade. Reabrir sala com o mesmo token substitui a conexão anterior.
9. Se não houver perguntas inéditas e revisadas do tema, oferecer outros temas; não repetir silenciosamente nem consultar uma API durante a partida.

## Aplicação das decisões e validação

D01–D06 foram respondidas em 23/10/2026; os esclarecimentos de D06 e o minigame de D09 também estão confirmados em [decisões](decisoes.md). D02/D03/D06/D09 foram aplicadas na integração de T39. A T20 aplica D05 com teto de 100; restam a consolidação das demais tarefas e a validação de equilíbrio/duração com pessoas. Os detalhes anteriores sobre desfecho coletivo e faixas dos empatados estão resolvidos.

A [integração experimental da T36](modo-classico.md) executa quatro modalidades sorteadas e a final na quinta posição em desenvolvimento/teste. Empates recebem vidas iguais, ausência na final aplica dano coletivo ou sorteio e eliminações simultâneas abrem o combate. O roubo aplica o teto aprovado de 100, conforme a T20.

O [piloto mecânico da T32](testes-de-grupo-e-equilibrio.md) compara parâmetros para dinamite, velocidade, aposta e roubo em execuções locais com jogadores roteirizados e relógio virtual. Seus resultados anteriores não validam as novas políticas. Atualizar cenários e parâmetros após a implementação; a avaliação humana de equilíbrio ainda não foi realizada.
