# Primeiro lote editorial — T11

Revisão realizada em **17/10/2026**. Foram publicadas **72 perguntas em pt-BR**, adaptadas de candidatos Questionados sob MIT. Cada pergunta conserva o ID e o objeto `source` originais, além de referência factual, data e conferência de fatos, idioma e resposta única. A atribuição e a licença acompanham o catálogo.

## Distribuição

| Tema | Fáceis | Médias | Difíceis | Total |
|---|---:|---:|---:|---:|
| Artes e literatura | 6 | 4 | 2 | 12 |
| Geografia | 6 | 4 | 2 | 12 |
| História | 6 | 4 | 2 | 12 |
| Cultura pop | 6 | 4 | 2 | 12 |
| Ciência e natureza | 6 | 4 | 2 | 12 |
| Esportes | 6 | 4 | 2 | 12 |
| **Total** | **36** | **24** | **12** | **72** |

Há estoque para oferecer os seis temas em um aquecimento isolado de seis perguntas, com **três fáceis e três médias**, conforme o [plano do jogo](plano-do-jogo.md#dificuldade). Após essa amostra, cada tema ainda tem três fáceis, uma média e duas difíceis. Até quatro temas podem ser apresentados pela futura seleção. Esta entrega verifica disponibilidade, sem implementar o seletor da T12 ou o motor de partida.

**Este é um lote inicial para fases isoladas.** Não cobre uma partida completa com doze jogadores, em especial dinamite e reserva de 50 perguntas para a final. Também não substitui as 300 perguntas da T27 nem as 5.000 da T33. O início de partida continua desabilitado.

## Evidência individual e método

- [Seis arquivos revisados](../data/questions/reviewed/README.md): versões finais usadas na publicação.
- [Decisões por ID](../data/publication-reports/t11-editorial.json): enunciado, alternativas e gabarito antes/depois, justificativa, referência factual, dificuldade e data de cada uma das 72 revisões.
- [Catálogo com manifesto](../data/questions/published/catalog.json): quantidade, estoque, hash e atribuição MIT embutidos.
- [Relatório da publicação](../data/publication-reports/questions.json): 72 aprovadas, nenhuma duplicata estrutural ou erro de publicação e 1.531 candidatos excluídos da entrada de promoção.

As referências foram consultadas individualmente em órgãos públicos, instituições científicas, museus, entidades esportivas, estúdios, arquivos cinematográficos e gravadoras. A referência de “25”, da XL Recordings, foi conferida pelo conteúdo indexado no buscador, pois a abertura direta retornou HTTP 403; essa limitação está registrada na decisão. Os textos das fontes foram usados para conferir fatos, sem copiar artigos, letras de músicas ou imagens.

Foram revisadas as quatro alternativas de cada registro, o gabarito, o critério do enunciado, a linguagem e a distinção entre obras/versões. Treze registros mantiveram integralmente enunciado, alternativas e gabarito após conferência; 59 receberam alguma alteração nesses campos. As 72 aprovações são decisões individuais registradas, não consequência automática do validador. Os scripts verificam estrutura, procedência, licenças e consistência dos artefatos.

A comparação editorial entre os 72 registros não encontrou perguntas que repitam o mesmo fato com outras palavras. Variantes sobre fotossíntese, Abaporu, Mona Lisa, A Noite Estrelada, Titanic e Homem de Ferro ficaram fora do lote. Os dois quadros de Van Gogh são obras distintas; perguntar pela maior área oceânica e pela localização da Ilha de Páscoa também verifica fatos diferentes. Repetição de artista ou país, por si só, não foi tratada como duplicata.

As dificuldades são **provisórias**, atribuídas para o público geral brasileiro: reconhecimento de fatos difundidos nas fáceis, conhecimento escolar/cultural específico nas médias e detalhes históricos, termos técnicos ou autoria arquitetônica nas difíceis. Não houve calibração estatística com jogadores; a distribuição deve ser reavaliada após uso. O recorte de artes e literatura concentra artes visuais e arquitetura, e o de esportes concentra futebol; ambos precisam de maior diversidade na expansão.

## Correções de maior impacto

| Registro original | Problema | Decisão e referência |
|---|---|---|
| Geografia, índice de origem 3 | Gabarito populacional desatualizado e sem data | Pergunta fixada em 2023; resposta conferida na [UNFPA Índia](https://india.unfpa.org/en/publications/indias-population-growth-and-policy-implications) |
| Geografia, índice de origem 19 | Os quatro países das alternativas são atravessados pelo Danúbio | Pergunta reformulada para o mar que recebe sua foz, com quatro mares distintos; [ICPDR](https://www.icpdr.org/danube-basin/receiving-sea-black-sea) |
| Geografia, índice de origem 25 | “Maior lago” não especificava área ou volume | Critério explícito de volume de água doce; [USGS](https://www.usgs.gov/media/images/lake-baikal-space-largest-oldest-and-deepest-lake) |
| Ciência, índice de origem 7 | A unidade básica de herança estava como DNA | Alternativa corrigida para gene; [NHGRI](https://www.genome.gov/genetics-glossary/Gene) |
| Ciência, índice de origem 10 | Temperatura no SI também admite grau Celsius em contexto próprio | Especificadas unidade de base e temperatura termodinâmica; [BIPM](https://www.bipm.org/en/si-base-units/kelvin) |
| Esportes, índice de origem 31 | Técnico de 2002 com gabarito de outro técnico | Gabarito corrigido conforme a [FIFA](https://www.fifa.com/pt/news/articles/copa-2002-brasil-campeao-penta) |
| Esportes, índice de origem 54 | Quantidade de ouros em Tóquio incorreta | Gabarito corrigido e realização em 2021 explicitada; [COB](https://www.cob.org.br/comunicacao/noticias/atletas-olimpicos-sao-recebidos-pelo-presidente-da-republica-jair-bolsonaro-em-brasilia) |
| Artes, índice de origem 60 | Davi poderia ser atribuído a mais de um escultor das alternativas | Fixados mármore, 1501–1504 e museu de Florença; [Galleria dell’Accademia](https://www.galleriaaccademiafirenze.it/en/artworks/david-michelangelo/) |
| Artes, índice de origem 96 | MASP sem identificar edifício e gênero que denunciava a resposta | Especificado o edifício da Paulista de 1968; [MASP](https://www.masp.org.br/seminarios/o-masp-de-lina-50-anos-do-edificio-na-avenida-paulista) |
| Cultura pop, índice de origem 24 | Voz de Woody sem idioma ou filme | Fixados áudio original em inglês e filme de 1995; [créditos do AFI](https://catalog.afi.com/Film/55210-TOY-STORY) |

Outros ajustes incluem polo geográfico, área do oceano, inauguração oficial do Canal do Panamá, Segunda Guerra na Europa, tratado definitivo de 1871, reinado de Elizabeth I, fundação da WSPU e anos/versões de filmes. Os índices acima são os da fonte, que podem diferir da posição no arquivo importado após deduplicação.

## Preservação e verificação

Os 28 arquivos JSON de candidatos e `data/sources.json` conservaram seus bytes e SHA-256 durante a revisão. Os hashes estão em `unchangedInputsSha256` no relatório individual. Continuam 531 candidatos `needs-review` em pt-BR e 1.000 `needs-translation` em inglês; as aprovações existem somente nas cópias em `reviewed/`. Nenhuma nova importação foi executada.

As verificações de publicação, carregamento real e qualidade estão registradas nas [evidências da T11](tasks/T11-primeiro-lote-editorial.md). O relatório editorial também fica no diretório privado de relatórios já bloqueado pelo Vite; o catálogo e os gabaritos não são importados pela web ou por shared.
