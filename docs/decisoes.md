# Decisões de produto e implementação

## Respostas registradas em 23/10/2026

O usuário respondeu D01–D08 e esclareceu os empates, acrescentando D09. As escolhas abaixo substituem as propostas anteriores; registrar uma escolha não significa que sua implementação foi concluída. O [índice das tasks](tasks/README.md) continua sendo o único controle de status de implementação.

| ID | Decisão registrada | Estado e tarefas afetadas |
|---|---|---|
| D01 | Aprovar a meta de **20 a 30 minutos** para 4 a 8 pessoas, com tempos parametrizados; grupos maiores podem ultrapassar | Confirmada. T13, T32, T36; validar a duração com pessoas |
| D02 | Se ninguém responder à pergunta da final no prazo, **todos os participantes ainda ativos perdem uma vida** | Aplicada na integração de T39 em desenvolvimento/teste |
| D03 | Se quem acertou não escolher alvo no prazo de seis segundos, **sortear entre todos os participantes ainda ativos, incluindo quem acertou** | Aplicada na integração de T39 em desenvolvimento/teste. Não priorizar quem tem mais vidas |
| D04 | Aprovar **dinamite por turnos**, dois por participante, com prazo individual completo | Aplicada na T21 em desenvolvimento/teste, com política confirmada nos parâmetros, plano e contrato público; ocupa posição 1 a 4 quando sorteada |
| D05 | Somente o primeiro acerto pode roubar, com transferência de **até 100 pontos**, limitada ao saldo do adversário; todos que acertam recebem os 100 pontos do acerto | Aplicada na T20 em desenvolvimento/teste: teto 100 após os créditos; sem escolha, nenhuma transferência |
| D06 | Empate em pontos e acertos antes da final resulta em **vidas iguais por colocação, sem pular posições**: grupo em 1º recebe 5, próximo grupo em 2º recebe 4, depois 3 e 2 para o 4º grupo em diante | Aplicada na integração de T39 em desenvolvimento/teste; sem sorteio residual nem perguntas extras |
| D07 | Aprovar a proposta de definir a direção visual a partir do protótipo | Abordagem aprovada e concretizada na T30 com os tokens existentes do protótipo; a resposta não selecionou uma nova paleta. Resta a revisão em hardware físico |
| D08 | Hospedar da mesma forma que o Comicle, deixando a publicação por último. Em **26/10/2026**, usar a VM existente do Comicle, redimensionada pelo usuário para `flex.large` | Piloto instalado via MCP AWS/SSM na `comicle-prod`, `c7i-flex.large`, `us-east-2`. Acesso HTTPS em `dionel.site/penshow/`, com rotas Cloudflare validadas e Comicle preservado. Aceites globais de T35 continuam pendentes |
| D09 | Empatados por eliminação simultânea disputam **minigame de tiro 2D top-down**, começando com **3 vidas cada**. Ao chegar a zero, o jogador recebe uma pergunta: **erro elimina; acerto concede 1 vida** | Implementada na T39 em desenvolvimento/teste; ver [guia](desempate-tiro.md) e evidências na tarefa |

### Esclarecimentos confirmados sobre os empates

O usuário respondeu às duas dúvidas derivadas de D02 e D06:

- **D02/D09 — eliminação simultânea:** quando mais de um participante perde a última vida na mesma resolução, os empatados disputam o minigame de tiro. Isso também resolve o caso em que todos os ativos da final chegam a zero juntos. A perda coletiva de D02 continua válida; não declarar empate definitivo nem decidir por ordem de conexão. As três vidas iniciais do minigame são próprias dele, separadas das vidas do quiz.
- **D06 — posições consecutivas por grupo:** a proposta de pular colocações foi rejeitada. Dois empatados em 1º recebem cinco vidas cada; o próximo participante ou grupo ocupa o 2º lugar e recebe quatro, o seguinte recebe três e os demais recebem dois. Se todos empatarem em pontos e acertos, todos entram na final com cinco vidas. O número de pessoas em um grupo não consome faixas adicionais.

No minigame, cada nova chegada a zero vidas dá ao jogador uma pergunta: se acertar, volta com uma vida; se errar, morre. O [plano de implementação de T39](plano-desempate.md) detalha controles, arena, cadência, prazos, ausência, lotes de perguntas, rede e integração de resultados como escolhas iniciais de protótipo, separadas das respostas fornecidas pelo usuário. O minigame está integrado em desenvolvimento/teste; avaliação humana de equilíbrio permanece em T32.

## Publicação solicitada em 26/10/2026

O usuário informou que mudou a VM do Comicle para `flex.large` e pediu instalar o PENSHOW nela. A instalação foi executada via MCP AWS/SSM na `comicle-prod`, `i-05748174e8c875a20`, `us-east-2`, `c7i-flex.large`. Usa serviço Compose próprio e API sob `/penshow/api/`, pois o Comicle ocupa `/api/`. O piloto está disponível em [dionel.site/penshow/](https://dionel.site/penshow/), com as duas origens HTTPS permitidas explicitamente. As rotas `dionel.site/penshow` e `dionel.site/penshow/*` foram publicadas no Worker dedicado `penshow-proxy` e validadas no domínio principal. A [evidência T35](validation/t35-piloto-compartilhado.md) registra implantação e verificações reais, separadas da preparação local e dos aceites globais ainda pendentes.

A autorização de publicação não atesta 5.000 perguntas nem validações humanas: o artefato atual é identificado como piloto e habilita o jogo em produção por configuração explícita. A meta editorial e os aceites T30–T32 permanecem abertos.

## Outras regras confirmadas

Em **23/10/2026**, o usuário solicitou narrar as perguntas antes de responder, com voz totalmente robotizada, sem tentar imitar uma pessoa. A entrega usa síntese clássica em pt-BR e reserva no servidor a duração medida da gravação antes de abrir as respostas. A primeira versão lê somente o enunciado, com ativação e volume locais; leitura das alternativas não foi confirmada. Consulte [narrador robótico](narrador-robotico.md).

Os requisitos estão em [regras](regras.md). Para colocações sem empate, a final distribui 5 / 4 / 3 / 2 vidas para sobreviver a 4 / 3 / 2 / 1 perdas. Somente a primeira resposta de cada pergunta é avaliada: erro custa uma vida ao autor; acerto permite tirar uma vida de qualquer adversário ainda com vida. Não há outra tentativa na mesma pergunta. A escolha manual continua restrita a adversários; a possibilidade de atingir o próprio autor ocorre no sorteio automático de D03. A ausência coletiva de resposta segue D02.

Em **20/10/2026**, o usuário definiu o **modo clássico como padrão**, com **cinco fases totais**, modalidades diferentes em ordem aleatória e a **final sempre por último**. A [T36](tasks/T36-modo-classico-padrao.md) integra quatro fases de pontuação e a final na quinta posição. Para o catálogo atual, sorteia quatro entre as cinco modalidades de pontuação e sua ordem, sem repetição. A sequência está implementada em desenvolvimento/teste; sua consolidação exige aplicar e validar as respostas de 23/10/2026.

Pontos e tempos que não foram confirmados expressamente continuam sujeitos à avaliação humana em T32. A aprovação de D01 é uma meta de duração, não uma medição ou garantia. A aprovação da dinamite não substitui a avaliação de equilíbrio. Relatórios e testes anteriores com variantes de 50 pontos ou pausas de D02/D03 são evidências históricas da versão então executada.

## Diretrizes técnicas

- Monólito modular com `apps/web`, `apps/server` e `packages/shared`, seguindo o Comicle e a [arquitetura](arquitetura.md).
- Estado vivo de sala/sessão em memória e catálogo local de conteúdo aprovado. PostgreSQL e Drizzle somente com requisito concreto adicional de persistência/recuperação.
- Reaproveitamento seletivo de identidade, avatares e salas; módulos de histórias e desenho não são necessários.
- Gabaritos privados do servidor durante a pergunta; catálogo não integra bundle nem arquivos estáticos do navegador.
- Aproveitar ferramentas de conteúdo existentes, preservando licenças e procedência.
- Hospedagem na VM compartilhada com o Comicle, conforme atualização de D08 em 26/10/2026; inspecionar o destino e preservar o serviço existente, sem presumir credenciais ou configurações não verificadas.

## Como atualizar uma decisão

Registrar a resposta, motivo quando houver e tarefas afetadas; atualizar a regra e o plano correspondentes no mesmo conjunto de alterações. Não transformar sugestão de implementação ou resultado de teste em escolha do usuário. Manter distintas a decisão de produto, sua aplicação no código e sua validação.
