# Expansão editorial — T33

Em **22/10/2026**, o lote `t33-001` acrescenta **36 traduções revisadas**, de inglês para pt-BR, às 300 perguntas da T11/T27. Duas duplicatas por sentido foram rejeitadas. O catálogo publicado contém **336 perguntas**; faltam **4.664** para a meta. O status da tarefa fica no [índice](tasks/README.md).

## Conteúdo e atribuição

| Tema | Novas fáceis | Novas médias | Novas difíceis | Total publicado |
|---|---:|---:|---:|---:|
| Artes e literatura | 2 | 2 | 2 | 56 |
| Geografia | 2 | 2 | 2 | 56 |
| História | 2 | 2 | 2 | 56 |
| Cultura pop | 2 | 2 | 2 | 56 |
| Ciência e natureza | 2 | 2 | 2 | 56 |
| Esportes | 2 | 2 | 2 | 56 |
| **Total** | **12** | **12** | **12** | **336** |

Cada tema passa a ter 17 fáceis, 22 médias e 17 difíceis. Não foram habilitados temas novos. Cinco das seis novas perguntas de artes são de literatura; esportes acrescenta golfe, tênis, tênis de mesa, automobilismo e curling. O conjunto anterior ainda concentra artes visuais e futebol; a distribuição de dificuldade é editorial, sem calibração com jogadores.

As novas perguntas são adaptações do **Open Trivia DB**, sob **CC BY-SA 4.0**, conforme a [documentação da fonte](https://opentdb.com/api_config.php) consultada nesta revisão. Os 300 registros anteriores conservam a atribuição Questionados/MIT. Os candidatos originais, IDs, posições na coleta, URLs e licenças permanecem intactos. A publicação inclui as duas atribuições e seus textos de licença; referências factuais não substituem a origem licenciada da pergunta.

A revisão/tradução foi assistida por IA e conferiu cada registro com conteúdo acessível ou indexado de referências externas. Não houve revisão humana independente. [t33-001.json](../data/editorial-batches/t33-001.json) guarda os originais completos, versões revisadas, datas, referências, justificativas, chaves de fatos e comparação semântica declarada. As adaptações incluem tradução, precisão do enunciado, correções, distratores e dificuldade. As cópias em [reviewed/t33-001.json](../data/questions/reviewed/t33-001.json) conservam as decisões individuais; os candidatos não são promovidos em massa.

## Casos conferidos

| Caso | Decisão e referência |
|---|---|
| Thomas Hardy | Wessex é uma região literária, e não um único condado; [National Trust](https://www.nationaltrust.org.uk/discover/history/people/where-is-thomas-hardys-wessex). |
| Svalbard | Substituído dependência por parte do território norueguês; [governo da Noruega](https://www.regjeringen.no/en/documents/meld.-st.-26-20232024/id3041130/?ch=1). |
| Casa Branca | Corrigido 1812 para **1814** e especificada residência presidencial, pois outros edifícios foram incendiados; [White House Historical Association](https://www.whitehousehistory.org/rebuilding-the-white-house-and-u-s-capitol). |
| Po em Kung Fu Panda | Versão original em inglês e filme de 2008 explicitados; [DreamWorks](https://prod.dreamworks.com/movies/kung-fu-panda). |
| Goldfinger | Corrigido o nome de Shirley Bassey e distinguida a intérprete do compositor John Barry; [site oficial 007](https://www.007.com/goldfinger-remastered-soundtrack-announced/). |
| Mendel | Pergunta reformulada para experimentos de hereditariedade com ervilheiras; o original falava em genetic crossovers; [NHGRI](https://www.genome.gov/25520230/online-education-kit-1865-mendels-peas). |
| Candela | Intensidade luminosa diferenciada de fluxo luminoso e iluminância; [BIPM](https://www.bipm.org/en/si-base-units/candela). |
| Golfe | Terminologia conferida no conteúdo indexado da [USGA](https://www.usga.org/content/usga/home-page/history/faq--golf-history-questions-232994f0.html); abertura direta retornou 403. A [notícia da USGA de 2012](https://www.usga.org/content/usga/home-page/articles/2012/08/ko-leads-qualifying-at-2012-us-womens-amateur-21474849206.html) também registra eagle com duas tacadas em um par 4. |
| Davi e Mona Lisa | Rejeitadas por repetirem autorias já publicadas. Cada decisão aponta o ID do representante. |

As demais referências e justificativas constam por registro no lote. A revisão comparou o atributo da entidade perguntada com as 300 anteriores e entre os novos itens. As duas perguntas sobre ouro no tênis de mesa do Rio de 2016 distinguem individual feminino e masculino. Datas e versões de filmes estão explícitas; não foram introduzidos recordes correntes ou titulares de cargos sem período.

## Auditoria e histórico de correções

```sh
pnpm questions:publish
pnpm questions:validate
pnpm questions:check
pnpm questions:audit
pnpm questions:audit --batch=t33-001
pnpm questions:audit --check
```

`questions:audit` verifica a publicação atual contra a compilação oficial e as versões de cada registro. Parte do snapshot privado das 300 anteriores, `data/editorial-baselines/t27-catalog.json`, e aplica `data/editorial-batches/*.json` por `sequence`. Cada lote informa o hash do catálogo com o qual comparou os fatos; o `original` deve coincidir integralmente com o candidato ou a revisão anterior. O `revised` deve coincidir com a lista revisada atual. Mudança posterior exige outro lote, preservando o antes/depois.

Para o próximo lote, usar ID novo, sequência seguinte, data, método e registros conferidos individualmente. Não editar um lote passado para esconder uma correção. Rejeições continuam no histórico e ficam fora da contagem. `duplicateOf` identifica representante aprovado, quando houver. A chave `factKey` identifica o atributo factual revisado; repetir uma chave entre aprovações novas gera erro. Uma resposta igual, por si só, não caracteriza duplicata. As 300 anteriores têm evidência semântica na T11/T27 e não receberam chaves retroativas inventadas.

`--batch` imprime o comprovante do lote, sem escrever relatório nem modificar/publicar perguntas; também verifica o histórico compartilhado e colisões entre lotes. `--check` compara o relatório global em memória com os bytes versionados, sem escrever. A CI executa esse check. A ferramenta verifica rastreabilidade e declarações, sem acessar referências nem certificar verdade, idioma, tradução, dificuldade ou independência humana.

[t33-expansion.json](../data/publication-reports/t33-expansion.json) registra 336 publicáveis, duas rejeitadas e **1.193 candidatos ainda sem decisão**: 231 do Questionados e 962 do Open Trivia DB. Mesmo se todos fossem aprováveis, seriam necessários ao menos **3.471 candidatos adicionais**. Esse é um limite inferior; duplicatas e rejeições aumentam a necessidade real. Disponibilidade anunciada pela API não entra na contagem publicada.

## Capacidade para partidas consecutivas

```sh
pnpm questions:capacity
pnpm questions:capacity --check
```

[t33-consecutive-stock.json](../data/publication-reports/t33-consecutive-stock.json) usa `QuestionSelection`, o catálogo **atual** e os parâmetros oficiais experimentais. São **280 percursos**: quatro tamanhos (2/4/8/12), duas sementes, cada um dos seis temas isoladamente e o conjunto dos seis, e cinco conjuntos de quatro modalidades produzidos pelo plano clássico oficial. A ordem de cada conjunto é uma representante; as 120 ordens continuam cobertas no experimento histórico da T36.

O cenário consome as quatro fases e **exatamente 50 perguntas na final simulada**, depois inicia outra seleção excluindo todos os IDs já consumidos. Asserções impedem repetição entre partidas e verificam que a reserva pode ser consumida. A recusa de novo início e as sobras por dificuldade também são registradas.

| Pessoas | Partidas consecutivas com os seis temas | Perguntas consumidas nos percursos |
|---:|---:|---:|
| 2 | 3 | 216–222 |
| 4 | 3 | 222–228 |
| 8 | 3 | 222–252 |
| 12 | 2–3 | 184–276 |

Um tema isolado foi recusado em todos os percursos. O total bruto por tema não supera a falta de fáceis para as fases e a reserva. A final real pode consumir menos ou mais que 50: esses números descrevem um cenário mecânico, sem garantir partidas completas, medir duração, decidir vidas ou impor teto à final. A revanche mantém ineditismo por partida; este simulador não muda o produto para compartilhar histórico entre partidas.

As simulações T27, T36 e T32 agora leem explicitamente o snapshot de 300 perguntas usado em seus relatórios. Seus bytes históricos e conclusões permanecem reproduzíveis. O servidor continua lendo somente `data/questions/published/catalog.json`; nenhum snapshot, candidato, gabarito ou documento editorial entra na web.

## Continuidade

Faltam 4.664 aprovações com qualidade editorial. Os próximos lotes devem ampliar literatura, modalidades esportivas e cobertura cultural/geográfica, evitando concentrar a coleta em jogos eletrônicos ou preencher a meta com paráfrases. Novas fontes entram com licença, manifesto e candidatos antes da revisão. Novos temas exigem estoque por dificuldade e verificação da seleção; uma contagem total alta não basta.

Depois de cada lote, publicar, auditar e reproduzir a capacidade atual. Amostras cruzadas por tema/dificuldade devem complementar a revisão individual. Calibração com jogadores e revisão humana independente continuam ausentes. A T33 só termina quando pelo menos 5.000 registros publicáveis e os critérios de diversidade e qualidade forem atendidos.
