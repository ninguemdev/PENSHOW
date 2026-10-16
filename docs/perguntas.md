# Banco de perguntas

## Estratégia

Manter o conteúdo disponível localmente no servidor. APIs e repositórios externos são usados na preparação, sem chamadas durante uma partida. O objetivo de expansão é **5.000 perguntas revisadas em pt-BR**, com distribuição útil por temas; esse objetivo não significa que já existam 5.000 perguntas prontas.

Os totais efetivamente importados e a distribuição por categoria ficam em [`data/sources.json`](../data/sources.json). Candidatos, inclusive os já escritos em português, precisam de revisão factual e editorial antes de serem publicados para o jogo.

## Fontes selecionadas

| Fonte | Conteúdo | Uso e limites |
|---|---|---|
| [Questionados](https://github.com/AdaiasMagdiel/questionados/tree/dc99d66a70f7e9f8039c0833b9aa9211907ee719/assets/data) | Perguntas de quatro alternativas em português, seis temas | Importação do commit fixo; licença MIT preservada em `data/licenses/questionados.txt`; material fica em revisão |
| [Open Trivia DB](https://opentdb.com/api_config.php) | Perguntas categorizadas, em inglês | Coleta opcional com token para evitar repetições; CC BY-SA 4.0; traduzir e revisar antes do uso |

A [contagem oficial do Open Trivia DB](https://opentdb.com/api_count_global.php) consultada na pesquisa informava 5.299 perguntas verificadas. Isso é a disponibilidade reportada pela fonte, não o tamanho do banco do PENSHOW. O serviço limita cada chamada a 50 perguntas e cada IP a uma requisição a cada cinco segundos, conforme sua documentação.

Não importar listas apenas porque estão públicas. Verificar licença, formato, procedência e qualidade. Não usar perguntas extraídas do Brain Show.

## Categorias

Coleta inicial em português: artes e literatura, geografia, história, cultura pop, ciência e natureza, esportes. A coleta complementar mantém temas específicos de filmes, música, jogos, televisão, tecnologia, matemática, animais, mitologia e outros.

Na revisão, separar Brasil quando houver conteúdo suficiente e evitar uma categoria residual dominante. Selecionar temas de partida somente quando houver quantidade suficiente de perguntas aprovadas e inéditas.

## Formato normalizado

Cada arquivo em `data/questions/candidates/<source>/<category>.json` contém registros com:

| Campo | Significado |
|---|---|
| `id` | ID determinístico da fonte, tema e enunciado |
| `category` | Identificador estável de tema |
| `locale` | `pt-BR` para o conteúdo em português ou `en` para o original em inglês |
| `type` | `multiple` ou `boolean` |
| `prompt` | Enunciado em texto, sem HTML |
| `options` | Alternativas com IDs estáveis |
| `correctOptionId` | Referência à alternativa correta, privada do servidor |
| `difficulty` | Dificuldade fornecida pela fonte ou `unrated` |
| `status` | `needs-review`, `needs-translation`, `approved` ou `rejected` |
| `source` | Identificador, URL imutável quando possível, posição original e licença |

IDs editoriais das alternativas não serão expostos diretamente durante partidas: algumas fontes colocam sempre a resposta na primeira posição. Embaralhar no servidor e gerar IDs públicos opacos, preservando uma associação privada ao registro original.

## Importação e validação

```sh
npm run questions:import
npm run questions:import:opentdb -- --amount=1000
npm run questions:validate
npm test
```

O importador em português lê literais de dados sem executar JavaScript remoto. Elimina repetições literais após normalizar caixa, acentos, pontuação e espaços. Entradas malformadas, alternativas repetidas e gabaritos inválidos vão para um relatório separado; não são consertados por adivinhação.

O importador em inglês utiliza token de sessão, intervalo de pelo menos 5,5 segundos entre chamadas e persistência por lote. Em nova execução, evita repetir os enunciados já coletados. `--amount` é o total pretendido para essa fonte; atingir esse total não implica cobertura equilibrada de todas as categorias. Não afirmar que os registros estão traduzidos.

Duplicatas aproximadas entre fontes e traduções ainda exigem revisão. A validação automática garante a estrutura e encontra repetições normalizadas no mesmo idioma; ela não comprova a verdade da resposta nem a ausência de paráfrases.

## Problemas já observados na amostra

No arquivo de geografia do Questionados, a pergunta sobre o país mais populoso apresenta um gabarito desatualizado; há uma pergunta sobre o Danúbio com vários países plausíveis nas alternativas, além de enunciados que não especificam o critério de tamanho de um lago. Essas observações impedem promover toda a lista diretamente a conteúdo jogável.

Correções serão registradas por ID com referência factual e data; perguntas ambíguas devem ser reformuladas ou rejeitadas. Nenhum registro recebe `approved` apenas por passar no validador.

## Publicação editorial planejada

1. Verificar o enunciado, o critério e a existência de uma única alternativa correta.
2. Conferir a resposta com fonte factual adequada; guardar referência e data de revisão.
3. Corrigir ortografia e tradução para pt-BR, mantendo títulos e nomes reconhecíveis.
4. Ajustar dificuldade e tema; revisar alternativas e possíveis dicas involuntárias.
5. Evitar perguntas voláteis sem data de referência. Quando necessárias, informar ano ou período.
6. Detectar repetição por sentido e preservar a procedência de registros fundidos.
7. Marcar `approved` e copiar para um catálogo publicado separado, carregado apenas pelo servidor.

Atribuições de conteúdo e licenças de terceiros devem continuar acompanhando os dados e suas adaptações. O código do jogo e o conteúdo importado têm licenças próprias; uma licença do projeto não substitui as licenças das bases.
