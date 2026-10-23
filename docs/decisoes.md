# Decisões de produto e implementação

## Regras confirmadas

Em **23/10/2026**, o usuário solicitou narrar as perguntas antes de responder, com voz totalmente robotizada, sem tentar imitar uma pessoa. A entrega usa síntese clássica em pt-BR e reserva no servidor a duração medida da gravação antes de abrir as respostas. A primeira versão lê somente o enunciado, com ativação e volume locais; leitura das alternativas não foi confirmada. Consulte [narrador robótico](narrador-robotico.md). Isso não resolve D01–D08 nem altera as regras confirmadas da final.

Os requisitos R01 a R09 estão em [regras](regras.md). Para a final, a distribuição é 5 / 4 / 3 / 2 vidas para sobreviver a 4 / 3 / 2 / 1 perdas. Somente a primeira resposta de cada pergunta é avaliada: erro custa uma vida ao autor, acerto permite tirar uma vida de qualquer adversário ainda com vida. Não há outra tentativa na mesma pergunta.

Em **20/10/2026**, o usuário solicitou adicionar uma tarefa para implementar o **modo clássico como padrão**, com **cinco fases totais**, modalidades diferentes em ordem aleatória e a **final sempre por último**. A [T36](tasks/T36-modo-classico-padrao.md) registra quatro fases de pontuação e a final na quinta posição. Para o catálogo atual, planeja sortear quatro entre as cinco modalidades de pontuação e sua ordem, sem repetição. Essa estrutura substitui a proposta de cinco fases fixas mais final; o modo ainda será implementado. As decisões D02–D06 não foram respondidas por esse pedido.

A organização por três pacotes, servidor autoritativo, projeção por jogador e regras modulares segue a [arquitetura](arquitetura.md) e o reaproveitamento do [Comicle](analise-comicle.md).

## Consultas registradas

D01 a D06 foram enviadas durante a elaboração do plano detalhado. Não há resposta registrada para elas. Padrões abaixo são propostas, não aprovação por silêncio.

| ID | Questão | Proposta de trabalho atual | Estado |
|---|---|---|---|
| D01 | Duração desejada de uma partida | Meta de 20 a 30 minutos para 4 a 8 pessoas, com tempos parametrizados; grupos maiores podem ultrapassar | Em consulta |
| D02 | Se ninguém responder à pergunta da final | Pular sem tirar vidas | Em consulta |
| D03 | Se acertar na final e não escolher alvo | Após seis segundos, atacar adversário com mais vidas, sorteando em caso de empate | Em consulta |
| D04 | Variante da modalidade de pressão, anteriormente prevista como quinta fase | Dinamite por turnos, dois por participante, prazo individual completo; na T36, pode ocupar uma das posições 1 a 4 quando sorteada | Em consulta |
| D05 | Quem pode roubar em cada pergunta | Primeiro acerto rouba até 50; demais acertos também ganham 100 | Em consulta |
| D06 | Empate de pontos e acertos antes da final | Sorteio residual no plano atual; alternativas consultadas incluem perguntas extras e vidas iguais | Em consulta |

Pontos e tempos das cinco fases são parâmetros experimentais do [plano do jogo](plano-do-jogo.md). A avaliação em grupo de T32 consolida ou ajusta esses valores com evidência. Isso não autoriza alterar as regras confirmadas da final.

A [T13](pontuacao-e-parametros.md) implementa esses parâmetros em uma configuração congelada por partida e cálculos puros no servidor. D04/D05 são identificadas explicitamente como variantes de protótipo; D01–D06 permanecem em consulta. Os exemplos aritméticos e a parametrização foram testados, sem representar avaliação de equilíbrio ou aprovação do produto.

## Decisões de etapas posteriores

| ID | Questão | Situação | Tarefas |
|---|---|---|---|
| D07 | Direção visual definitiva | A definir com protótipo; ainda não há escolha registrada. Não impede componentes acessíveis com estilos provisórios | T05, T30 |
| D08 | Destino, URL e acesso para hospedar | A definir; não presumir EC2, serviço pago ou caminho público | T34, T35 |

Essas duas decisões não foram apresentadas como respondidas nem como consultas já enviadas. Perguntar quando a etapa exigir essa informação, continuando antes com o trabalho independente.

## Diretrizes técnicas do plano

- Monólito modular com `apps/web`, `apps/server` e `packages/shared`, seguindo o Comicle.
- Estado vivo de sala/sessão em memória e catálogo local de conteúdo aprovado. PostgreSQL e Drizzle somente com requisito concreto adicional de persistência/recuperação.
- Reaproveitamento seletivo de identidade, avatares e salas; módulos de histórias e desenho não são necessários.
- Gabaritos privados do servidor durante a pergunta; catálogo não integra bundle nem arquivos estáticos do navegador.
- Ferramentas de conteúdo já existentes serão aproveitadas, preservando licenças e procedência.

## Como atualizar uma decisão

Registrar a resposta, motivo quando houver e tarefas afetadas; atualizar a regra e o plano correspondentes no mesmo conjunto de alterações. Não transformar sugestão de implementação ou resultado de um teste em escolha do usuário. O [índice das tasks](tasks/README.md) continua sendo o único controle de status de implementação.

## Integração experimental da T36

A sequência completa de cinco fases está implementada em desenvolvimento/teste, conforme [modo clássico](modo-classico.md). A consulta sobre adotar as propostas D02–D06 foi reapresentada em 21/10/2026; sem resposta registrada, o modo conserva variantes experimentais de roubo/dinamite e pendências explícitas de empate/final sem resposta ou alvo. Isso não consolida essas decisões.
