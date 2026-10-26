# Desempate de tiro 2D

A T39 integra o desempate à final em desenvolvimento/teste. A arena abre automaticamente quando pelo menos dois participantes perdem a última vida de quiz na mesma resolução coletiva. Perder uma vida e continuar ativo não inicia o combate; empates de pontos/acertos antes da final recebem vidas iguais, sem saltos entre os grupos de colocação.

## Como funciona

- Somente o grupo empatado entra na arena, com três vidas de combate por participante.
- Ao chegar a zero, o jogador recebe uma pergunta de sobrevivência. Acerto devolve exatamente uma vida; erro ou prazo sem resposta elimina do combate. Novas chegadas a zero repetem o procedimento, sem limite artificial de recuperações.
- A arena inteira pausa durante as perguntas. Se vários zerarem no mesmo passo, cada um recebe uma pergunta privada e inédita; o combate espera o lote completo. A leitura/narração antecede os quinze segundos de resposta.
- Depois da revelação e contagem, quem acertou reaparece em posição livre, com uma vida e um segundo de proteção. Durante essa proteção não atira nem recebe dano.
- Mortes definitivas do mesmo lote continuam empatadas e abrem um novo combate apenas para esse subgrupo. Quem já conquistou uma posição não precisa disputá-la novamente.

O quiz espera o resultado do grupo. Havendo sobreviventes no quiz, eles conservam sua vantagem e o combate define apenas o intervalo de colocações dos eliminados. Se todos os ativos do quiz forem eliminados juntos, o vencedor do desempate é o campeão, sem restaurar vidas de quiz. O pódio informa a vitória por tiro; a revanche limpa combate, entradas e timers.

## Controles e interface

Computador: WASD ou setas para mover; mouse ou IJKL para mirar; clique ou Espaço para manter tiro. Celular: controle esquerdo para movimento e direito para mira/tiro. Perder foco, ocultar a aba, soltar/cancelar toque ou desconectar neutraliza os controles; a entrada expira após 250 ms sem renovação.

Canvas desenha arena, obstáculos, avatares existentes e projéteis. Vidas, instruções, cronômetro, pergunta, respostas e resultado são HTML. A pergunta própria recebe foco ao aparecer. Espectadores e jogadores fora do grupo acompanham o combate sem receber perguntas alheias. Narração e sons usam as preferências já existentes; disparos têm som curto com agrupamento para limitar a sobreposição.

## Implementação

`modules/tiebreak/combat.domain.ts` simula passos fixos de 50 ms, movimento normalizado, obstáculos, tiros com cadência de 300 ms e colisão no segmento do projétil. Todos os impactos do passo são recolhidos antes de mudar vidas; cada personagem recebe no máximo um dano por passo. Sob atraso, executa um único passo por callback e desacelera a simulação em vez de acumular uma rajada de dano.

`modules/tiebreak/tiebreak.domain.ts` mantém grupo, subcombates, lotes de perguntas e resultado. A integração fica no `MatchService` existente, sob `Room.runExclusive`, evitando um segundo proprietário do ciclo da partida. O servidor guarda perguntas preparadas, intenções e checkpoint privados; a projeção permite somente a pergunta do proprietário. O seletor de sobrevivência compartilha usados, reserva e temas do seletor da partida. Exige perguntas médias suficientes para o lote e preserva uma pergunta média adicional quando o quiz continuará; esgotamento interrompe sem inventar campeão.

`tiebreak:input` envia intenção de movimento/mira/gatilho com partida, fase, combate, subcombate, geração e sequência. O servidor mantém somente a intenção mais recente por participante, revalida sessão/conexão na aplicação e decide posição, cadência, colisão e dano. Entradas têm orçamento próprio de trinta por segundo; não aumentam o limite dos comandos de quiz. `tiebreak:answer` aceita uma resposta própria dentro do prazo.

`tiebreak:frame` publica posições e projéteis até dez vezes por segundo, sem perguntas ou gabaritos. O quadro comum é validado uma vez antes de distribuir às conexões atuais. Visões completas continuam nas transições, danos, perguntas, presença e resultado; não são transmitidas em cada passo de movimento. O navegador acompanha quadros e versões confiáveis separadamente, evitando que um quadro novo impeça pergunta/resultado ou que um quadro antigo reabra uma arena encerrada.

As regras geométricas e temporais iniciais estão em `TIEBREAK_RULES`, imutáveis, e a arena em `TIEBREAK_OBSTACLES`. São escolhas de protótipo do [plano](plano-desempate.md), não novas decisões atribuídas ao usuário. Não houve publicação, criação de VM ou serviço externo.

## Verificação

- Domínio: 2/4/12 participantes, movimento, colisões, cadência, impacto simultâneo, proteção, perguntas privadas, leitura longa, prazo exato, recuperação repetida e subgrupos empatados.
- Serviço: empate originado por D02 real, coalescência/obsolescência de entradas, quadros compactos, pergunta, recuperação, reconexão, campeão com zero vidas de quiz, participante fora do grupo e revanche.
- Navegador: `e2e/tests/tiebreak.spec.ts` usa aplicação e transporte reais; testa teclado/mouse no desktop e controles por toque no celular emulado, recarga durante pergunta, acerto, nova chegada a zero, erro e pódio. Não injeta impactos, dano ou vencedor.
- Quadros no cliente: contexto e geração antigos são rejeitados; tick alto não bloqueia uma visão confiável de pergunta e posições não regridem ao receber uma fotografia mais antiga do mesmo combate.

Comandos: `pnpm test:e2e:tiebreak` após build; `pnpm tiebreak:benchmark` para cinco minutos virtuais com três salas de doze participantes; `pnpm pilot:simulate` para os percursos roteirizados de grupo. O benchmark registra seus limites e a máquina em `docs/validation/t39-load.json`; usa controles neutros para medir agendamento, transações, clonagem e publicação, enquanto tiro e perguntas são verificados separadamente. O piloto atual escreve `t39-group-pilot.json` e preserva `t32-group-pilot.json` como histórico.

Resultados executados ficam na [T39](tasks/T39-desempate-tiro-top-down.md). Os testes não substituem avaliação humana de conforto, latência real ou equilíbrio em T32. A publicação T35 continua por último, aguardando a VM do usuário.
