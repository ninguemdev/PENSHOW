# Decisões de produto e implementação

## Regras confirmadas

Os requisitos R01 a R08 estão em [regras](regras.md). Para a final, a distribuição é 5 / 4 / 3 / 2 vidas para sobreviver a 4 / 3 / 2 / 1 perdas. Somente a primeira resposta de cada pergunta é avaliada: erro custa uma vida ao autor, acerto permite tirar uma vida de qualquer adversário ainda com vida. Não há outra tentativa na mesma pergunta.

A organização por três pacotes, servidor autoritativo, projeção por jogador e regras modulares segue a [arquitetura](arquitetura.md) e o reaproveitamento do [Comicle](analise-comicle.md).

## Consultas registradas

D01 a D06 foram enviadas durante a elaboração do plano detalhado. Não há resposta registrada para elas. Padrões abaixo são propostas, não aprovação por silêncio.

| ID | Questão | Proposta de trabalho atual | Estado |
|---|---|---|---|
| D01 | Duração desejada de uma partida | Meta de 20 a 30 minutos para 4 a 8 pessoas, com tempos parametrizados; grupos maiores podem ultrapassar | Em consulta |
| D02 | Se ninguém responder à pergunta da final | Pular sem tirar vidas | Em consulta |
| D03 | Se acertar na final e não escolher alvo | Após seis segundos, atacar adversário com mais vidas, sorteando em caso de empate | Em consulta |
| D04 | Modalidade da quinta fase | Dinamite por turnos, dois por participante, prazo individual completo | Em consulta |
| D05 | Quem pode roubar em cada pergunta | Primeiro acerto rouba até 50; demais acertos também ganham 100 | Em consulta |
| D06 | Empate de pontos e acertos antes da final | Sorteio residual no plano atual; alternativas consultadas incluem perguntas extras e vidas iguais | Em consulta |

Pontos e tempos das cinco fases são parâmetros experimentais do [plano do jogo](plano-do-jogo.md). A avaliação em grupo de T32 consolida ou ajusta esses valores com evidência. Isso não autoriza alterar as regras confirmadas da final.

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
