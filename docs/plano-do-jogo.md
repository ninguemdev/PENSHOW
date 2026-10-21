# Plano do jogo — PENSHOW

## 1. Estado das decisões

Este documento detalha uma partida completa para orientar os primeiros protótipos. As regras **confirmadas** vieram das decisões do projeto. Pontos, quantidades e tempos identificados como **proposta** são valores iniciais para testar com amigos, não decisões atribuídas ao usuário.

Confirmado para a final: vidas iniciais de 5 / 4 / 3 / 2, para sobreviver a 4 / 3 / 2 / 1 perdas; somente a primeira resposta de cada pergunta é avaliada; erro custa uma vida; acerto permite tirar uma vida de qualquer adversário ainda na disputa.

**Atualização de 20/10/2026 — modo clássico padrão:** o usuário definiu cinco fases no total, com modalidades diferentes em ordem aleatória e a final obrigatoriamente na quinta posição. A [T36](tasks/T36-modo-classico-padrao.md) planeja quatro modalidades distintas sorteadas entre as cinco de pontuação disponíveis e depois a final. O pedido substitui a sequência fixa de seis etapas proposta abaixo. As fichas, números de fase e orçamentos antigos permanecem como referência dos protótipos; a T36 deve adequar seleção, pontuação acumulada, interfaces e simulações ao plano sorteado. D02–D06 continuam em consulta.

Perguntas enviadas durante este planejamento: duração desejada, pergunta da final sem resposta, ataque sem escolha de alvo, dinâmica da quinta fase, quantidade de jogadores com direito ao roubo e desempate antes da final. Enquanto não houver resposta, as alternativas de trabalho abaixo permanecem propostas. Isso permite concluir o planejamento sem bloquear a tarefa e sem transformar silêncio em confirmação.

## 2. Partida padrão proposta anteriormente — referência dos protótipos

Uma **fase** é uma das seis etapas da partida. Uma **pergunta** é uma disputa dentro de uma fase. Na dinamite, um **turno** é a pergunta exclusiva de um participante.

| Fase | Modalidade | Quantidade | Quem responde | Pontuação proposta |
|---|---|---|---|---|
| 1 | Aquecimento (quiz clássico) | 6 perguntas | Todos | Acerto +100; erro ou ausência 0 |
| 2 | Velocidade | 6 perguntas | Todos | Acerto +100 e bônus de 0, 25 ou 50 |
| 3 | Aposta | 6 perguntas | Todos | Acerto +100 e a aposta; erro perde a aposta |
| 4 | Roubo | 6 perguntas | Todos | Acerto +100; primeiro acerto pode roubar até 50 |
| 5 | Dinamite | 2 turnos por participante | Somente quem está com a dinamite | Acerto +300; erro ou ausência −150 |
| 6 | Final | Até restar um jogador com vida | Só a primeira resposta é avaliada | Erro −1 vida; acerto permite ataque de −1 vida |

As fases 1 a 5 acumulam o mesmo placar. Todos começam com zero pontos; o saldo nunca fica negativo. Ninguém é eliminado definitivamente antes da final. A pontuação não é zerada ao trocar de fase.

As cinco primeiras fases são fixas e aparecem nesta ordem na primeira versão proposta. Sorteio de modalidades e partidas personalizadas ficam para depois dos testes do formato padrão.

Meta inicial de duração, ainda em consulta: cerca de 20 a 30 minutos para grupos de quatro a oito pessoas. Grupos pequenos tendem a terminar antes; doze participantes exigem um orçamento maior. A final não tem um limite fixo de perguntas que substitua a regra de último sobrevivente.

## 3. Entrada e preparação

1. Escolher apelido e montar o personagem, reaproveitando o editor e o catálogo do Comicle.
2. Criar uma sala ou entrar por convite/código, sem cadastro.
3. No lobby, o anfitrião seleciona os temas habilitados e vê o resumo das seis fases.
4. Exibir participantes, conexão e regras da final. Proposta inicial: de 2 a 12 participantes.
5. Ao iniciar, fixar a lista de jogadores, seus perfis e as configurações daquela partida.
6. Quem chegar depois assiste e participa da revanche. O anfitrião joga nas mesmas condições.

Iniciar somente quando houver conteúdo revisado suficiente. O lobby deve informar por que uma configuração está indisponível, sem apresentar detalhes internos da implementação.

## 4. Ritmo de cada fase

Valores padrão propostos:

| Etapa | Duração | Comportamento |
|---|---:|---|
| Instruções da fase | Até 15 s | Regra, pontos, exemplo e botão de pronto; avançar antes se todos os participantes conectados confirmarem |
| Escolha do tema | Até 10 s | Um jogador escolhe entre até quatro temas elegíveis |
| Leitura do enunciado | 3 s | Exibir pergunta e tema; alternativas ainda indisponíveis |
| Resposta nas fases 1 a 4 | Até 15 s | Uma escolha definitiva por jogador; encerrar quando todos responderem ou o prazo acabar |
| Aposta, quando aplicável | Até 6 s | Antes do enunciado, mostrar tema e dificuldade e receber apostas seladas |
| Escolha do alvo, quando aplicável | Até 6 s | Depois de fechar as respostas, somente o jogador autorizado escolhe |
| Revelação nas fases 1 a 4 | 4 s | Gabarito, explicação curta e mudanças individuais de pontos |
| Intervalo entre perguntas | 1 s | Exibir a próxima posição na sequência |
| Resultado da fase | 8 s | Mostrar placar, variação de posição e resumo da etapa |

O relógio de resposta começa ao liberar as alternativas. O jogador não precisa apertar um botão para reservar a vez: escolher a alternativa envia a resposta. Na final, esse envio disputa a primeira resposta entre todos.

Os demais não veem a alternativa nem se alguém acertou antes de fechar as respostas. Mostrar apenas quem já confirmou. Quem respondeu não pode trocar a alternativa nem ter uma segunda tentativa.

Durante a revelação, mostrar separadamente pontos do acerto, bônus, aposta, roubo ou penalidade. Exemplo: `+100 por acertar · +25 por velocidade = +125`.

## 5. Temas, dificuldade e variedade

### Temas iniciais

Priorizar história, geografia, ciência e natureza, esportes, artes e literatura e cultura pop. Separar cinema, música, jogos, televisão, tecnologia e Brasil quando houver volume revisado suficiente. Importação em inglês não torna automaticamente um tema disponível em português.

### Escolha do tema

Proposta: cada fase inicial tem um tema escolhido antes de suas perguntas. A final mistura os temas habilitados.

- Em cada fase, sortear até quatro temas com conteúdo suficiente e permitir que um participante escolha.
- Manter uma fila de escolha: ninguém escolhe novamente antes de todos terem tido a oportunidade. Sortear a ordem inicial; ela não depende da entrada na sala nem do placar.
- Há apenas cinco escolhas antes da final; com mais de cinco participantes, alguns não escolherão naquela partida. Na revanche da mesma sala, continuar a fila para compensar.
- Sem escolha no prazo: sortear um dos temas apresentados.
- Evitar o tema da fase anterior quando houver alternativas elegíveis. Repetir um tema não permite repetir perguntas.
- Na final, alternar temas sem escolhas extras a cada pergunta; completar um ciclo dos temas disponíveis antes de reiniciar.

### Dificuldade

| Fase | Distribuição proposta |
|---|---|
| Aquecimento | 3 fáceis e 3 médias |
| Velocidade | 2 fáceis, 3 médias e 1 difícil |
| Aposta | 2 fáceis, 2 médias e 2 difíceis |
| Roubo | 2 fáceis, 2 médias e 2 difíceis |
| Dinamite | Uma pergunta média e uma difícil para cada participante |
| Final | Alternar fáceis e médias, com distribuição equivalente entre temas |

Na primeira versão, cada acerto vale o indicado pela modalidade; dificuldade não aplica multiplicador adicional. Ela muda o desafio e, na aposta, fornece informação antes de escolher o risco.

A dificuldade precisa de revisão editorial. Registros sem classificação não entram automaticamente como fáceis. Se faltar uma faixa, o tema fica indisponível para aquela fase ou exige substituição previamente informada; não trocar silenciosamente a dificuldade durante uma partida.

## 6. Fase 1 — Aquecimento

Objetivo: ensinar a dinâmica e formar um primeiro placar sem punição por erro.

- Seis perguntas de quatro alternativas; todos respondem à mesma pergunta.
- Acertou: **+100 pontos**.
- Errou ou não respondeu: **0 pontos**.
- Velocidade não altera o valor do acerto.
- Máximo individual da fase: **600 pontos**.

Exemplo: quatro acertos em seis perguntas somam 400 pontos. O placar deve mostrar também o número de acertos, para o participante entender o resultado.

## 7. Fase 2 — Velocidade

Objetivo: premiar conhecimento e rapidez, limitando o peso de diferenças muito pequenas de tempo.

Seis perguntas de quatro alternativas; todos respondem. Para uma resposta correta, usar o tempo entre a liberação das alternativas e a recepção no servidor:

| Momento da resposta | Pontos pelo acerto | Bônus | Total |
|---|---:|---:|---:|
| De 0 até antes de 5 s | 100 | 50 | 150 |
| De 5 até antes de 10 s | 100 | 25 | 125 |
| De 10 até antes de 15 s | 100 | 0 | 100 |
| Erro ou prazo esgotado | 0 | 0 | 0 |

- Resposta recebida exatamente no prazo final não é aceita.
- Não há classificação por milissegundos dentro da mesma faixa.
- Mostrar as faixas antes de começar e o bônus na revelação.
- Máximo individual da fase: **900 pontos**.

Exemplo: acertar em 4 s, 7 s e 12 s soma `150 + 125 + 100 = 375`. Um erro em 2 s continua valendo zero.

As faixas reduzem diferenças pequenas, mas não eliminam vantagem de conexão. A final também depende da chegada da resposta ao servidor; isso precisa ser explicado nas instruções e observado nos testes.

## 8. Fase 3 — Aposta

Objetivo: decidir quanto arriscar com base no tema e na dificuldade, sem permitir que uma única aposta comprometa toda a partida.

Seis perguntas. Antes de cada enunciado, abrir uma janela de seis segundos mostrando somente tema, dificuldade e saldo.

- Apostas disponíveis: **0, 25 ou 50 pontos**, somente quando cobertas pelo saldo atual.
- Aposta não escolhida no prazo: **0 pontos**.
- Aposta fica oculta dos adversários até a revelação.
- Acertou: recebe **100 pontos mais o valor apostado**.
- Errou ou não respondeu: perde **somente o valor apostado**.
- Não é necessário apostar para responder. Um jogador com menos de 25 pontos pode jogar apostando zero.
- Velocidade não muda a pontuação nesta fase.

Fórmula: acerto `saldo final = saldo anterior + 100 + aposta`; erro `saldo final = saldo anterior − aposta`. A validação da aposta impede saldo negativo; não há desconto prévio seguido de cobrança duplicada.

Exemplo: com 500 pontos, apostar 50 e acertar leva a **650**. Apostar 50 e errar leva a **450**.

Máximo individual da fase: **+900 pontos**, se houver saldo para apostar 50 em todas. Perda máxima da fase: **300 pontos**, limitada pelo saldo disponível.

## 9. Fase 4 — Roubo

Objetivo: permitir interação e recuperação de posições, mantendo pontuação por conhecimento para todos.

**Proposta de trabalho enviada para escolha:** somente o primeiro que acertar pode roubar; os demais acertos também pontuam.

- Seis perguntas; todos respondem dentro do mesmo prazo.
- Cada acerto recebe **+100 pontos**; erro ou ausência recebe zero.
- Depois de fechar as respostas, identificar a primeira resposta correta recebida. Uma resposta errada mais rápida não bloqueia a modalidade.
- Somente esse jogador recebe seis segundos para escolher qualquer adversário participante com saldo positivo.
- Transferir **até 50 pontos** do alvo para quem roubou: `roubo = mínimo(50, saldo do alvo)`.
- Calcular o saldo do alvo depois de aplicar os pontos de acerto daquela pergunta.
- Sem alvo válido ou sem escolha no prazo: não ocorre roubo; os pontos do acerto permanecem.
- Alvos e respostas ficam ocultos até o momento da revelação correspondente. Não mostrar quem conquistou o roubo enquanto ainda houver respostas abertas.

O roubo transfere pontos existentes. O acerto cria os 100 pontos da modalidade; o roubo não cria outros 50 no placar total da sala.

Exemplo: Ana e Beto acertam, mas Ana responde primeiro. Ambos ganham 100. Se Beto tiver 340 depois desse crédito, Ana pode roubar 50: ela recebe **150 no total**, e Beto termina a pergunta com **290**. Se o alvo tiver apenas 30, transferem-se somente 30.

Máximo individual acrescentado na fase: **900 pontos**, se acertar todas e conquistar os seis roubos completos. Um jogador pode sofrer até 300 pontos de roubo na fase, limitado pelo saldo em cada pergunta. A vantagem de acertar primeiro é menor que o valor base do conhecimento.

Se a escolha do usuário for permitir roubo a todos os acertos, será necessário substituir esta ficha por uma resolução coletiva de transferências e revisar os limites. Não implementar os dois formatos simultaneamente por suposição.

## 10. Fase 5 — Dinamite

Objetivo: criar uma sequência de turnos com risco maior, sem entregar ao próximo jogador uma contagem já vencida.

**Proposta de trabalho enviada para escolha:** dinamite por turnos, com um prazo novo em cada turno. Alternativas em consulta: destaque com respostas simultâneas ou sequência de acertos.

### Quantidade e ordem

- Cada participante recebe **exatamente dois turnos**, mesmo que tenha errado o primeiro.
- Primeiro ciclo: uma pergunta média para cada pessoa. Segundo ciclo: uma difícil para cada pessoa.
- Sortear a ordem dos jogadores antes da fase; no segundo ciclo, percorrer a ordem inversa. A ordem não muda por acerto, erro ou posição no placar.
- Cada pergunta é inédita. Só o dono do turno pode responder; os outros acompanham.

### Tempo e pontuação

- Três segundos de leitura, **dez segundos completos** para responder, três de revelação e um de transição.
- Acertou: **+300 pontos** e a dinamite segue para o próximo turno.
- Errou ou não respondeu: a dinamite explode e perde **até 150 pontos**, respeitando o saldo mínimo zero.
- Depois de uma explosão, o próximo jogador recebe outra dinamite e o prazo completo.
- O pavio representa o prazo individual; não existe cronômetro global atravessando turnos.
- Não existe ataque, escolha de vítima nem perda de vidas nesta fase.

Máximo por participante: **+600 pontos**. Perda máxima: **300 pontos**, limitada pelo saldo. Com oito participantes são 16 turnos; com doze são 24. Todos continuam para a final.

Exemplo: começar com 1.000, acertar o primeiro turno e errar o segundo termina em `1.000 + 300 − 150 = 1.150`.

Essa versão usa a tensão visual da passagem de dinamite e garante duas oportunidades por pessoa. O valor de 300 por acerto compensa haver menos perguntas individuais nesta fase; precisa de teste de equilíbrio antes de ser confirmado.

## 11. Placar e equilíbrio das cinco fases

| Fase | Ganho individual máximo | Possível redução do saldo |
|---|---:|---|
| Aquecimento | +600 | Nenhuma |
| Velocidade | +900 | Nenhuma |
| Aposta | +900 | Até 300, de apostas erradas |
| Roubo | +900 | Até 300, se for alvo de todos os roubos |
| Dinamite | +600 | Até 300, por dois erros |
| Soma dos ganhos máximos | **+3.900** | O saldo total nunca fica negativo |

Esses são máximos individuais por fase, não uma promessa de que todos os jogadores possam obtê-los ao mesmo tempo. Na fase de roubo, só uma pessoa conquista o roubo de cada pergunta.

Proposta de equilíbrio: os acertos sempre têm valor relevante; velocidade e roubo acrescentam no máximo 50 por pergunta; a aposta também é limitada a 50; a fase de maior risco tem apenas dois turnos por pessoa. Não há multiplicador de última pergunta nem dobrar o placar ao entrar na final.

Registrar depois dos testes: pontuação média por fase, variação de posição, concentração de roubos e taxa de vitória por posição inicial da final. Não tratar o formato como equilibrado apenas por fechar a aritmética.

### Exemplo de uma trajetória possível

| Momento | Resultado ilustrativo | Variação | Saldo |
|---|---|---:|---:|
| Início | Zero pontos | 0 | 0 |
| Aquecimento | 4 acertos | +400 | 400 |
| Velocidade | 2 acertos de 150, 1 de 125 e 1 de 100 | +525 | 925 |
| Aposta | Aposta 25 nas seis: 4 acertos e 2 erros | +450 | 1.375 |
| Roubo | 4 acertos, 2 roubos de 50 e sofreu 1 roubo de 50 | +450 | 1.825 |
| Dinamite | 1 acerto e 1 erro | +150 | **1.975** |

O exemplo descreve um jogador, não a resolução completa de toda a sala.

## 12. Classificação antes da final

Ao encerrar a quinta fase, congelar o placar e mostrar quem ganhou cada faixa de vidas.

Desempate de trabalho proposto, com a escolha entre perguntas extras, sorteio e vidas iguais enviada para consulta:

1. Maior pontuação acumulada.
2. Maior número de acertos nas cinco fases.
3. Persistindo igualdade, sorteio entre os empatados, exibido como desempate antes da distribuição de vidas.

Não usar entrada na sala, condição de anfitrião ou ordem das conexões como critério. Não usar tempo de resposta acumulado, para que velocidade não decida também esse empate sem indicação. O sorteio final é uma proposta para avaliação; sua substituição não muda a pontuação das fases.

Cada participante tem 26 oportunidades de resposta antes da final: 24 nas quatro primeiras fases e duas na dinamite. A quantidade total de perguntas exibidas à sala varia porque os turnos da dinamite são individuais.

## 13. Fase 6 — Final

### Vidas confirmadas

| Colocação antes da final | Vidas iniciais | Perdas às quais sobrevive | Eliminação |
|---|---:|---:|---|
| 1º | 5 | 4 | Na quinta perda |
| 2º | 4 | 3 | Na quarta perda |
| 3º | 3 | 2 | Na terceira perda |
| 4º em diante | 2 | 1 | Na segunda perda |

Os pontos servem para distribuir essas vidas uma única vez. Durante a final não há pontos, apostas, roubo, cura ou recálculo de vidas nesta proposta.

### Uma disputa por pergunta

1. Mostrar o enunciado por três segundos e liberar as quatro alternativas por até 15 segundos.
2. A primeira resposta válida recebida pelo servidor fecha as tentativas daquela pergunta para todos.
3. Se estiver errada, tirar **uma vida de quem respondeu**; não permitir que outro tente a mesma pergunta.
4. Se estiver certa, abrir **seis segundos** para esse jogador escolher qualquer adversário ainda com vida.
5. Tirar **uma vida** do alvo escolhido; não há contra-ataque ou defesa nessa pergunta.
6. Exibir resultado, atualizar vidas e resolver eventual eliminação. Depois abrir outra pergunta se ainda houver disputa.

Uma pergunta respondida causa somente uma perda: erro do primeiro ou ataque do primeiro que acertou. Respostas posteriores são rejeitadas sem dano. Um clique inválido ou enviado por espectador/eliminado não reserva a oportunidade.

Mostrar a escolha como `Sua resposta foi a primeira` apenas depois de o servidor aceitá-la. Os demais veem a pergunta fechada; o cliente não promete prioridade antes da confirmação.

### Situações consultadas durante o planejamento

| Situação | Proposta de trabalho, ainda não confirmada |
|---|---|
| Ninguém respondeu até 15 s | Revelar e passar para a próxima pergunta, sem perda de vidas |
| Acertou, mas não escolheu alvo em 6 s | Atacar automaticamente o adversário com mais vidas; sortear se houver empate |
| Acertou e desconectou antes de escolher | Aguardar o mesmo prazo e aplicar a mesma regra de alvo automático |

A proposta de alvo automático serve somente à ausência de escolha. Enquanto o prazo estiver aberto, o jogador mantém o direito confirmado de escolher qualquer adversário.

### Vitória e classificação final

Proposta: o último participante com vida vence a partida. O segundo é o último eliminado; o terceiro é o penúltimo eliminado, e assim por diante. Como cada jogada tira só uma vida de uma pessoa, não há empate por eliminação simultânea nesse fluxo.

O placar das fases anteriores aparece como histórico; não substitui a vitória na final. Eliminados acompanham como espectadores, sem enviar respostas nem escolher alvos. A revanche retorna todos os membros presentes ao lobby com pontuação e vidas zeradas para uma nova partida.

## 14. Duração e quantidade de perguntas

### Antes da final

Para `N` participantes, há `24 + 2 × N` perguntas exibidas: seis em cada uma das quatro primeiras fases e dois turnos por pessoa na dinamite.

Orçamento conservador usando os prazos inteiros propostos: 624 segundos nas quatro primeiras fases; 34 segundos por participante na dinamite; mais cerca de 210 segundos para instruções, temas, placares e entrada na final. Fórmula: `(834 + 34 × N) / 60` minutos antes da final.

### Na final

Com duas pessoas há nove vidas ao todo. Com três ou mais, há `2 × N + 6`. Como cada jogada que aplica dano retira uma vida e a disputa termina com um sobrevivente, a quantidade de **jogadas com perda de vida** fica nos intervalos abaixo.

| Participantes | Perguntas antes da final | Jogadas com dano na final | Antes da final com prazos inteiros | Partida com todas as jogadas respondidas, usando prazos inteiros |
|---|---:|---:|---|---|
| 2 | 28 | 4 a 8 | Cerca de 15 min | Até cerca de 19 min |
| 4 | 32 | 9 a 13 | Cerca de 16 min | Até cerca de 23 min |
| 8 | 40 | 17 a 21 | Cerca de 18 min | Até cerca de 29 min |
| 12 | 48 | 25 a 29 | Cerca de 21 min | Até cerca de 35 min |

O orçamento da final considera até 29 segundos por jogada: três de leitura, 15 de resposta, seis de alvo, quatro de resultado e um de transição. Uma resposta errada dispensa a escolha de alvo; respostas e escolhas antecipadas também encurtam o tempo.

Esses números não são um limite garantido de duração. Perguntas puladas sem dano, reconexões, pausas e falta de escolha de alvo podem ampliar a partida. Se o usuário escolher perder o ataque em vez de alvo automático, perguntas respondidas também poderão terminar sem dano e essa estimativa deverá ser revisada.

## 15. Conexão, ausência e ações do anfitrião

Propostas operacionais:

- Queda não apaga pontos, resposta, aposta, turno nem vidas; voltar não concede prazo adicional.
- Nas fases 1 a 4, uma resposta ausente vale erro para a modalidade: zero no aquecimento/velocidade/roubo; perda da aposta na aposta.
- Na dinamite, o turno agendado permanece; se não voltar e responder no prazo, recebe a penalidade normal de até 150.
- Na final, ficar sem responder não tira vida individualmente: a perda por erro exige ser o primeiro a enviar uma resposta errada. A regra coletiva de prazo sem resposta continua em consulta.
- Adversário desconectado que ainda tem vidas pode ser alvo. Sem isso, desconectar permitiria evitar ataques.
- O anfitrião pode remover pessoas no lobby. Durante a partida, não pode expulsar um adversário para alterar a classificação; encerramento da partida deve ser coletivo e aparecer como interrupção sem vencedor.
- Se o anfitrião cair, transferir o controle após 30 segundos para um participante conectado. Isso não altera a vez, o placar ou o prazo.
- Se todos desconectarem, manter somente a janela atual até sua resolução normal, sem conceder tempo extra nem iniciar outra pergunta. Entre perguntas, aguardar retorno por até 120 segundos contados da última desconexão; ao voltar alguém, continuar do próximo passo pendente. Sem retorno nesse intervalo, encerrar sem vencedor. Se alguém voltar antes de a janela atual fechar, ela continua com seu prazo original.
- Uma segunda aba da mesma identidade substitui a conexão anterior; não cria outro participante.
- Reinício do servidor encerra salas na primeira versão proposta; recuperação após reinício não está incluída automaticamente.

Na primeira versão, não oferecer pausa manual no meio de perguntas. Isso evita interromper a disputa da primeira resposta depois de conhecer o enunciado. Uma pausa entre fases pode ser avaliada após os testes de grupo.

## 16. Conteúdo e disponibilidade

- Usar somente perguntas aprovadas editorialmente em pt-BR, com resposta única, alternativas distintas, fonte e dificuldade revisadas.
- Não repetir o mesmo enunciado na partida, inclusive se reaparecer em outra fonte ou modalidade. Detectar também repetições por sentido na revisão.
- Reservar um conjunto inicial de 50 perguntas para a final, distribuídas pelos temas habilitados; ele não pode ser consumido pelas fases anteriores.
- Ao escolher temas das fases iniciais, verificar o estoque restante por dificuldade. Na dinamite, exigir uma média e uma difícil por participante.
- Se o conjunto reservado da final terminar, buscar perguntas revisadas ainda inéditas nos temas habilitados. Não repetir silenciosamente para forçar uma conclusão.
- Sem conteúdo inédito suficiente, interromper de forma visível e oferecer retorno ao lobby sem declarar um vencedor inventado. A proposta de pular perguntas sem dano não permite garantir um catálogo finito para qualquer duração.
- Meta de primeiro teste de grupo: pelo menos 50 perguntas revisadas em cada um de seis temas, com distribuição compatível com o formato. Meta de expansão: 5.000 revisadas.
- Os 1.531 candidatos importados não cumprem automaticamente essa meta: ainda precisam de revisão, tradução quando aplicável e classificação de dificuldade.

## 17. Interface necessária por momento

| Tela | Informação principal | Ações disponíveis |
|---|---|---|
| Perfil | Apelido e personagem | Editar, sortear aparência, salvar |
| Lobby | Convite, participantes, temas e resumo da final | Entrar/sair; anfitrião configura e inicia |
| Instruções | Como responder, pontos e exemplo | Confirmar pronto |
| Tema | Opções elegíveis e responsável pela escolha | Responsável escolhe |
| Pergunta | Enunciado, alternativas, fase, progresso e prazo | Enviar uma resposta válida |
| Aposta | Tema, dificuldade, saldo e risco | Selecionar 0, 25 ou 50 |
| Alvo do roubo | Adversários e saldos | Primeiro acerto escolhe |
| Turno da dinamite | Dono do turno, ciclo e pavio individual | Dono responde; demais assistem |
| Revelação | Gabarito, explicação e variação de pontos | Aguardar transição |
| Resultado da fase | Placar e mudanças de posição | Aguardar próxima fase |
| Entrada na final | Conversão do placar em vidas | Ler regra e confirmar pronto |
| Final | Vidas, adversários e disputa da primeira resposta | Responder; vencedor do acerto escolhe alvo |
| Pódio | Campeão, ordem de eliminação e histórico de pontos | Revanche ou sair |

Usar texto e ícones além de cores para acerto, erro e vidas. Garantir botões confortáveis no celular, atalhos opcionais 1 a 4, foco visível, leitura de enunciados e controles por teclado. Sons com volume e opção de silenciar; movimento reduzido sem esconder informações essenciais.

## 18. Exemplos obrigatórios para validar o protótipo

| Caso | Resultado esperado |
|---|---|
| Resposta errada em 2 s na velocidade | Zero ponto, sem bônus |
| Resposta correta exatamente em 5 s | 125 pontos |
| Aposta 50 com saldo 25 | Recusar antes de mostrar o enunciado |
| Aposta zero e acerta | +100 pontos |
| Aposta 25 e não responde | −25 pontos, uma única vez |
| Roubo contra saldo de 30 | Transferir 30, sem deixar negativo |
| Mais rápido erra, segundo acerta no roubo | Segundo conquista o direito de roubar |
| Duas pessoas acertam no roubo | Ambas recebem +100; só a primeira recebe o roubo nesta proposta |
| Dinamite explode no jogador anterior | Próximo turno recebe dez segundos completos |
| Erra a primeira dinamite | Continua tendo o segundo turno e continua para a final |
| Líder perde quatro vidas na final | Permanece com uma; quinta perda elimina |
| Primeiro erra na final e segundo envia a correta | Primeiro perde uma vida; segunda resposta não é avaliada |
| Primeiro acerta na final | Somente ele recebe escolha de alvo; retirar uma vida do escolhido |
| Reenviar resposta ou escolha de alvo | Não duplicar pontos, roubo ou dano |
| Desconectar depois de acertar na final | Aplicar o mesmo prazo de alvo e a política que for confirmada |
| Duas respostas concorrentes na final | Uma única resposta aceita na fila do servidor |
| Espectador tenta responder | Rejeitar sem consumir a oportunidade |
| Todos estão empatados antes da final | Aplicar o desempate definido, sem usar ordem de entrada |
| Falta pergunta revisada e inédita | Não repetir nem carregar uma candidata sem aprovação |

## 19. O que validar com as respostas e com partidas reais

As seis perguntas enviadas nesta tarefa orientam duração, modalidade da quinta fase, roubo, ausência na final e desempate de classificação. Incorporar as respostas a este plano e a `regras.md` sem interromper as partes independentes da tarefa.

Depois do primeiro teste, revisar os valores de 300 / −150 da dinamite, a vantagem do primeiro acerto no roubo, a duração da final com grupos grandes e o critério residual de desempate. Não alterar as vidas confirmadas nem a exclusividade da primeira resposta por conveniência de implementação.
