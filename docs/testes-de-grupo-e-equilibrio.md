# Piloto de grupos e equilíbrio — T32

O piloto mecânico usa os serviços oficiais de sala e partida, o catálogo publicado de 300 perguntas e os parâmetros experimentais completos. Jogadores são roteirizados e o relógio é virtual. As durações registram o tempo percorrido pelo motor nesse roteiro; não são duração observada com pessoas, medição de rede ou avaliação de diversão.

O [relatório reproduzível](../data/publication-reports/t32-group-pilot.json) contém as configurações e seus hashes, hash do catálogo, seeds, resultados por fase e participante, conversão em vidas e resoluções da final. Usa aliases P1…P12; não exporta gabaritos, tokens ou identificadores de conexão. Não há telemetria externa nem alteração de parâmetros da aplicação.

## Como executar

```sh
pnpm --filter @penshow/shared build
pnpm pilot:simulate
pnpm pilot:simulate --check
```

O primeiro comando de simulação grava o relatório local. `--check` repete as execuções e compara os bytes sem escrever. A CI inclui essa verificação após os testes e a validação do estoque. A suíte do servidor também verifica a reprodução do relatório, conservação de pontos/tempo/oportunidades, ausência de gabaritos e as três pausas de produto.

## Método e limites

Para cada tamanho de 2, 4, 8 e 12 jogadores, a matriz executa oito seeds consecutivas, de 32 a 39. O sorteio real escolhe quatro modalidades distintas e mantém a final na quinta posição. Instruções e escolha de tema aguardam seus prazos completos; a política oficial seleciona o tema quando o prazo vence. Nenhum trecho da partida é pulado e os prazos da aplicação não são acelerados: somente o relógio injetado avança até eventos e ações.

Nas fases de pontuação, a probabilidade prescrita de acerto cai de 90% em P1 até 40% no último jogador, com 5% de ausência por oportunidade. O roteiro usa SHA-256 com seed/fase/pergunta/jogador para decidir acerto, ausência, atraso e aposta. Essas probabilidades são entradas sintéticas; acertos medidos nos resultados vêm das resoluções do servidor. Respostas chegam entre 500 ms e 500 ms antes do prazo, inclusive na dinamite. Apostas e alvos de roubo levam 1 s; alvos da final levam 1,5 s. Não há latência de transporte.

Na final mista, os ativos disputam a primeira resposta com atrasos prescritos e 70% de probabilidade de acerto, sem ausências. Seeds pares atacam a melhor classificação inicial disponível; ímpares atacam quem tem menos vidas. As duas políticas são roteiros artificiais. O relatório registra quem efetivamente venceu e sua classificação inicial, mas a amostra não estima a chance humana de vitória do líder.

O tempo total inclui instruções, escolha de tema, leitura, respostas, apostas, alvos, revelações e resultados das fases até pódio ou pausa. Cada avanço para no evento seguinte; a soma das etapas e fases precisa coincidir com o total. Partidas paradas ficam no relatório, com duração até a parada, e não entram no intervalo de partidas completas. O limite técnico de 2000 transições causa falha da ferramenta; não é um limite de duração do jogo.

Por fase, o relatório registra oportunidades, respostas, acertos, erros e ausências. Na dinamite, apenas o jogador do turno tem oportunidade. O histórico oficial fornece pontos de acerto, bônus de velocidade, apostas ganhas/perdidas, transferências de roubo e penalidades efetivamente aplicadas. Posições iguais por pontos permanecem empatadas, conforme a política atual de D06. Uma mudança entre posições empatadas e individuais precisa ser lida com os indicadores `tiedBefore`/`tiedAfter`.

## Resultados das referências

As 32 execuções de referência, com os parâmetros atuais, chegaram a 25 pódios e sete pausas por empate. A matriz completa também inclui 16 comparações de parâmetros e 12 casos dirigidos de pausa, totalizando 60 execuções. Nenhuma dessas execuções equivale a uma sessão humana.

| Jogadores roteirizados | Pódios / referências | Pausas D06 | Duração virtual dos percursos completos | Líder inicial venceu / pódios |
|---|---:|---:|---|---:|
| 2 | 8 / 8 | 0 | 9 min 35 s a 11 min 59 s | 2 / 8 |
| 4 | 8 / 8 | 0 | 13 min 04 s a 14 min 24 s | 3 / 8 |
| 8 | 5 / 8 | 3 | 15 min 32 s a 16 min 52 s | 1 / 5 |
| 12 | 4 / 8 | 4 | 17 min 28 s a 20 min 23 s | 2 / 4 |

Os tempos acima são truncados ao segundo; o JSON preserva milissegundos. A ausência de rede, conversa e leitura humana e as hipóteses de resposta impedem usar esses intervalos para aprovar a meta D01 de 20–30 minutos. Os quocientes de vitória têm amostra pequena e políticas artificiais de ataque; não validam ou invalidam as vidas confirmadas.

A dinamite apareceu em cinco referências por tamanho. Seus 4/8/16/24 turnos consumiram, respectivamente, 72–82 s, 122–140 s, 202–233 s e 314–347 s de tempo virtual, incluindo preparação e resultados. O crescimento com o grupo fica visível mesmo com resposta roteirizada. Precisamos observar se quem aguarda um turno considera essa espera adequada.

## Comparações experimentais

Cada tamanho recebe quatro execuções adicionais. A referência de cada comparação é um baseline que inclua a modalidade alterada, preferindo um que chegou ao pódio. As intenções de resposta e atrasos se mantêm por chave, sem consumir o RNG do jogo. Uma alteração por vez permite observar seus efeitos mecânicos; novos saldos, alvos elegíveis e empates podem mudar o percurso posterior.

| Experimento local | Referência atual | Alternativa da simulação |
|---|---|---|
| Dinamite | +300 / −150, penalidade limitada ao saldo | +200 / −100 |
| Velocidade | Bônus 50 / 25 / 0 nas mesmas faixas | 25 / 10 / 0 |
| Aposta | 0 / 25 / 50 | 0 / 25 |
| Roubo | Até 50, limitado ao saldo do alvo | Até 25 |

Essas alternativas são sondagens de sensibilidade, sem decisão de adotá-las. Se a modalidade não aparece no plano de uma referência, essa referência não é usada para compará-la. Alterações de duração quando uma execução para em empate não significam que a partida ficou mais curta. `changedInitialLives` e `changedWinner` ficam nulos quando não há duas conversões ou dois pódios comparáveis.

| Alternativa | Resultado nos pares de 2/4/8 jogadores | Resultado no par de 12 jogadores |
|---|---|---|
| Dinamite +200 / −100 | Pontos alterados; posições preservadas | Três posições alteradas; vidas iniciais e vencedor preservados |
| Velocidade 25 / 10 / 0 | Pontos alterados; posições preservadas | Pontos alterados; posições preservadas |
| Aposta até 25 | Pontos alterados; posições preservadas | Novo empate; parada em D06 |
| Roubo até 25 | Pontos alterados; posições preservadas | Novo empate; parada em D06 |

Nos 14 pares que chegaram ao pódio em ambas as configurações, as vidas iniciais e o vencedor permaneceram iguais. Os dois pares restantes não permitem comparar vencedor ou duração completa: os −328.786 ms indicam o trecho da final que deixou de ser percorrido após a pausa por empate. Há apenas um par por alternativa/tamanho, escolhido por cobertura de modalidade e percurso completo; essa seleção não estima frequência de empates ou equilíbrio da população. A hipótese útil para a revisão humana é avaliar também a formação de empates ao reduzir valores, além da agressividade percebida.

O orçamento atual ajuda a interpretar os resultados: dois acertos na dinamite rendem até 600 pontos, enquanto dois erros podem retirar até 300 se houver saldo. Nas modalidades de seis perguntas, o bônus de velocidade pode acrescentar até 300 pontos; a aposta de 50 pode acrescentar ou retirar até 300, limitada pela escolha e saldo de cada pergunta. O roubo pode transferir até 300 por autor numa fase de seis perguntas, com conservação do total transferido. Esses tetos mecânicos não são ganhos esperados nem evidência de equilíbrio percebido. Não houve ajuste decidido na configuração do jogo.

## Consultas e perguntas sem dano

D01–D06 permanecem explicitamente experimentais neste piloto. D01 continua sem meta de duração confirmada. D04/D05 usam somente as variantes de dinamite por turnos e primeiro acerto com direito ao roubo já implementadas. A avaliação dessas variantes não resolve a escolha do produto.

Além dos percursos mistos, cada tamanho exercita três casos dirigidos. Uma final sem resposta para em `final-no-answer-pending` (D02); acerto sem alvo para em `final-no-target-pending` (D03). Ambos registram uma pergunta aberta sem dano e nenhuma resolução dessa pergunta. Não pular nem atacar automaticamente é o comportamento atual do protótipo enquanto falta a decisão. O caso de erros em todas as fases conserva zero pontos e para antes da final com empate explícito (D06).

As vidas confirmadas 5/4/3/2 e a primeira resposta exclusiva são preservadas. Cada resolução da final precisa produzir exatamente uma perda de vida. O contador de perguntas abertas sem dano inclui a oportunidade pendente; não significa pergunta resolvida ou descartada.

Não há duração máxima de partida demonstrada por esta amostra. No estado atual, as pausas D02/D03/D06 podem permanecer sem prazo. Mesmo se D02 futuramente permitir pular perguntas sem dano, não se pode deduzir limite finito de duração apenas das vidas. O crescimento da dinamite por dois turnos por jogador e da quantidade de vidas da final precisa ser observado em grupos maiores.

## Próxima validação humana

O [roteiro de observação](roteiro-piloto-de-grupo.md) prepara sessões com 2, 4 e 8 pessoas e o registro de capacidade de 12. Separa medição, percepção e sugestão, inclui espera, agressividade das modalidades, vantagem da final, conforto sonoro e condições dos aparelhos. Não há sessão humana registrada nesta entrega.

T29 ainda depende da consolidação das regras; T30 tem pendências de direção visual e revisão física; T31 tem escuta humana pendente. Esses limites continuam explícitos. A T32 avança como preparação e evidência mecânica do piloto, sem concluir a aceitação dos grupos ou das dependências.

## Verificação desta entrega

- `pnpm pilot:simulate`: 60 execuções aprovadas, incluindo verificação de perguntas inéditas, perdas unitárias de vida, conservação dos roubos, soma dos tempos, igualdade das respostas nas comparações e pausas D02/D03/D06. Pelo menos um percurso completo por tamanho; 25 pódios nas referências, 14 nas alternativas e 21 pausas esperadas no conjunto.
- Suíte geral: 821 testes aprovados (34 de conteúdo, 5 de artes, 186 de shared, 433 de server e 163 de web). Os quatro novos casos do relatório verificam reprodução, contabilidade, privacidade e pausas; foram reexecutados após o ajuste final da ferramenta.
- Formatação, lint, tipos, build e `git diff --check` aprovados. Verificação integral do relatório com `pilot:simulate --check` adicionada à CI; essa repetição integral e a CI hospedada não foram executadas localmente. A reprodução local foi exercitada pelos testes focados.
- Nenhum parâmetro de pontuação/tempo da aplicação foi alterado. Nenhuma sessão humana, escuta, aparelho físico ou avaliação de percepção foi registrada como realizada.
