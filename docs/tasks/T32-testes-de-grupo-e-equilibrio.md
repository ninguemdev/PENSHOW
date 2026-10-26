# T32 — Testes com grupos e equilíbrio

- **Depende de:** [T29](./T29-e2e-partida-completa.md), [T30](./T30-acessibilidade-e-responsividade.md), [T31](./T31-sons-e-preferencias.md)
- **Pacotes:** docs, server, web
- **Marco:** M5
- **Branch sugerido:** `task/32-testes-de-grupo-e-equilibrio`

O status desta tarefa fica somente no [índice](README.md). O [piloto mecânico e seus limites](../testes-de-grupo-e-equilibrio.md) e o [roteiro de observação humana](../roteiro-piloto-de-grupo.md) registram as entregas preparatórias. Sessões humanas ainda não foram realizadas nesta tarefa; T29/T30/T31 conservam suas pendências de aceite.

## Objetivo

Validar os valores propostos e a duração com partidas observadas antes de tratar o formato como consolidado.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [decisoes.md](../decisoes.md)

## Atualização T21

D02/D03/D04/D05/D06/D09 já estão no piloto atual. `pilot:simulate` escreve `t21-group-pilot.json`; os relatórios T32/T39/T20 permanecem históricos. A matriz concluiu 60/60 percursos, com 2/4/8/12 participantes. A T20 aplica o teto de roubo de 100 e +100 para todos os acertos; a T21 confirma a dinamite nos parâmetros/plano/projeções; a validação humana permanece aberta. O roteiro de observação foi ampliado para controles, perguntas de sobrevivência e duração do combate.

## Entregáveis

- [x] Atualizar piloto, roteiro e relatórios para as respostas de 23/10/2026: meta de 20–30 minutos para 4–8 pessoas, roubo de até 100, perda coletiva sem resposta, sorteio de todos os ativos e vidas iguais por empate. Preservar os relatórios anteriores como evidência histórica.
- [ ] Medir duração, jogabilidade e clareza do desempate T39 com pessoas, incluindo recuperações sucessivas por acerto e controles em computador/celular; atualizar a meta de duração apenas com decisão e evidência.
- [ ] Executar sessões observadas com 2, 4 e 8 pessoas.
- [x] Verificar capacidade de 12 com teste documentado equivalente: serviços oficiais no piloto mecânico e integração HTTP/socket já documentada na T29.
- [ ] Registrar duração por fase, acertos, efeitos de aposta/roubo, mudanças de posição e vantagem inicial na final nas sessões humanas. Os registros mecânicos estão no relatório do piloto.
- [ ] Consolidar a revisão de +300 / −150 da dinamite, bônus de velocidade e limites de roubo/aposta com evidência mecânica e humana.
- [x] Atualizar plano, regras, parâmetros e expectativas dos testes para D02–D06/D09 aplicadas; novos ajustes dependerão de decisão e evidência.
- [x] Preparar ferramenta local com jogadores roteirizados, serviços oficiais, catálogo publicado e relógio virtual para os tamanhos 2/4/8/12.
- [x] Preparar comparação isolada de valores de dinamite, velocidade, aposta e roubo, sem alterar a configuração da aplicação.
- [x] Preparar ficha de sessão humana que separa dados cronometrados, percepção e sugestão.
- [x] Executar e registrar 60 percursos mecânicos: 32 referências, 16 comparações de parâmetros e 12 casos dirigidos de ausência/empate.

## Critérios de aceite

- [x] Relatório distingue medição, percepção e sugestão; não apresenta estimativa como tempo observado com pessoas.
- [x] As decisões D01–D06/D09 estão identificadas como confirmadas; variantes de pontuação comparadas são explicitamente experimentais e não alteram a aplicação.
- [x] Vidas confirmadas e primeira resposta exclusiva da final preservadas.
- [x] Método informa o crescimento com o grupo, as pausas e as perguntas sem dano, sem prometer limite de duração.

## Verificação

- [ ] Conferir registros de pelo menos uma partida completa por tamanho efetivamente testado com pessoas.
- [x] Conferir percursos completos com jogadores roteirizados para cada tamanho e preservar no relatório os empates e as demais pausas.
- [x] Reexecutar os cenários das políticas aplicadas: 902 testes, 60 percursos mecânicos e 32 percursos de navegador. Novos ajustes exigirão a regressão correspondente.

## Cuidados de implementação

Preferir relatório local e estatísticas agregadas da sessão; não adicionar telemetria externa para cumprir esta tarefa. Publicação definitiva permanece em T35, por último, após validações e preparação da VM.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências da entrega preparatória

- Branch `task/32-testes-de-grupo-e-equilibrio`; alterações anteriores preservadas.
- `scripts/lib/group-pilot.ts` usa comandos oficiais e relógio injetado, sem editar agregados para criar resultado. `pnpm pilot:simulate` grava o relatório privado e agregado em `data/publication-reports/t32-group-pilot.json`; `--check` o reproduz sem escrever.
- [Método e resultados](../testes-de-grupo-e-equilibrio.md): 25 pódios e sete empates nas 32 referências; todos os tamanhos têm percurso completo. As 16 alternativas geraram 14 pódios e dois empates adicionais. Os 12 casos dirigidos preservaram as pausas esperadas. Duração registrada é virtual, não observada com pessoas.
- Reduzir aposta ou roubo para 25 gerou novo empate no par de 12 jogadores; reduzir a dinamite alterou três posições, preservando as vidas atribuídas. São hipóteses para avaliação humana, sem ajuste da aplicação ou confirmação de regras.
- Suíte geral com 821 testes aprovada, incluindo quatro casos novos do relatório; regressão focada reexecutada após o ajuste final. Formatação, lint, tipos, build e verificação de whitespace aprovados.
- Verificação `pilot:simulate --check` adicionada à CI. A repetição integral com essa opção e a CI hospedada não foram executadas localmente; a matriz foi gerada e validada por `pilot:simulate`, e a reprodução foi testada no percurso focado.
- O [roteiro de sessões humanas](../roteiro-piloto-de-grupo.md) está pronto. Faltam observação com pessoas, percepção de equilíbrio e consolidação dos valores/regras; a tarefa conserva esses itens pendentes no índice e nesta checklist.
