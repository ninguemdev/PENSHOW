# Banco de perguntas

## Estratégia

Manter o conteúdo disponível localmente no servidor. APIs e repositórios externos são usados na preparação, sem chamadas durante uma partida. O objetivo de expansão é **5.000 perguntas revisadas em pt-BR**, com distribuição útil por temas; esse objetivo não significa que já existam 5.000 perguntas prontas.

Os totais efetivamente importados e a distribuição por categoria ficam em [`data/sources.json`](../data/sources.json). Candidatos, inclusive os já escritos em português, precisam de revisão factual e editorial antes de serem publicados para o jogo. A publicação atual tem **336 perguntas**; o [primeiro lote da T33](expansao-editorial-t33.md) acrescenta 36 traduções revisadas às 300 da T27.

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
| `review` | Para aprovação: `referenceUrl`, `reviewedAt` e confirmações explícitas de fatos, idioma e resposta única |

IDs editoriais das alternativas não serão expostos diretamente durante partidas: algumas fontes colocam sempre a resposta na primeira posição. Embaralhar no servidor e gerar IDs públicos opacos, preservando uma associação privada ao registro original.

## Importação e validação

```sh
pnpm questions:import
pnpm questions:import:opentdb --amount=1000
pnpm questions:validate
pnpm questions:publish
pnpm questions:check
pnpm questions:simulate --check
pnpm test:content
```

O importador em português lê literais de dados sem executar JavaScript remoto. Elimina repetições literais após normalizar caixa, acentos, pontuação e espaços. Entradas malformadas, alternativas repetidas e gabaritos inválidos vão para um relatório separado; não são consertados por adivinhação.

O importador em inglês utiliza token de sessão, intervalo de pelo menos 5,5 segundos entre chamadas e persistência por lote. Em nova execução, evita repetir os enunciados já coletados. `--amount` é o total pretendido para essa fonte; atingir esse total não implica cobertura equilibrada de todas as categorias. Não afirmar que os registros estão traduzidos.

Duplicatas aproximadas entre fontes e traduções ainda exigem revisão. A validação automática garante a estrutura e encontra repetições normalizadas no mesmo idioma; ela não comprova a verdade da resposta nem a ausência de paráfrases.

## Problemas já observados na amostra

No arquivo de geografia do Questionados, a pergunta sobre o país mais populoso apresenta um gabarito desatualizado; há uma pergunta sobre o Danúbio com vários países plausíveis nas alternativas, além de enunciados que não especificam o critério de tamanho de um lago. Essas observações impedem promover toda a lista diretamente a conteúdo jogável.

As correções desses três casos estão registradas por ID, referência factual e data no [relatório da T11](revisao-editorial-t11.md). Os candidatos originais permanecem intactos; as versões corrigidas estão em `reviewed/`. Perguntas ambíguas devem ser reformuladas ou rejeitadas. Nenhum registro recebe `approved` apenas por passar no validador.

## Publicação editorial

1. Verificar o enunciado, o critério e a existência de uma única alternativa correta.
2. Conferir a resposta com fonte factual adequada; guardar referência e data de revisão.
3. Corrigir ortografia e tradução para pt-BR, mantendo títulos e nomes reconhecíveis.
4. Ajustar dificuldade e tema; revisar alternativas e possíveis dicas involuntárias.
5. Evitar perguntas voláteis sem data de referência. Quando necessárias, informar ano ou período.
6. Detectar repetição por sentido e preservar a procedência de registros fundidos.
7. Copiar o registro escolhido para uma lista JSON em `data/questions/reviewed/`, preservando `id` e `source`. Registrar a revisão e marcar `approved` apenas depois de conferi-la. Gerar o catálogo com `pnpm questions:publish`.

Atribuições de conteúdo e licenças de terceiros devem continuar acompanhando os dados e suas adaptações. O código do jogo e o conteúdo importado têm licenças próprias; uma licença do projeto não substitui as licenças das bases.

### Entradas e validação

Os importadores continuam escrevendo somente em `candidates/`; não sobrescrevem o trabalho em `reviewed/`. Mesmo um registro marcado `approved` dentro de `candidates/` fica fora da publicação. A revisão pode corrigir texto, alternativas, gabarito, dificuldade e categoria; o ID editorial e a procedência original são preservados. A publicação exige correspondência com um candidato único e com a licença declarada em `data/sources.json`. Novas origens precisam entrar pelo fluxo de candidatos/manifesto; não são aceitas por trocar o identificador da fonte em um registro revisado.

`apps/server/src/modules/questions/editorial-question.schema.ts` é o validador privado único, usado pelo servidor e reexportado por `scripts/lib/questions.mjs`. Ele rejeita campos desconhecidos, HTML/entidades ainda não decodificadas, caracteres de controle, tema fora do formato, alternativas vazias/equivalentes, IDs repetidos, gabarito inexistente, URL de origem/referência que não seja HTTP(S), licença vazia e índice de origem inválido. Perguntas múltiplas têm quatro alternativas; booleanas, duas. Referência não pode carregar credenciais; data deve ser um dia real no formato `AAAA-MM-DD`.

Uma aprovação exige pt-BR, dificuldade `easy`, `medium` ou `hard`, referência factual e data. Também exige a declaração editorial abaixo, preenchida após a conferência:

```json
{
  "referenceUrl": "https://exemplo.org/referencia-factual",
  "reviewedAt": "2026-10-17",
  "checks": { "factual": true, "language": true, "uniqueAnswer": true }
}
```

Essa declaração não comprova fatos, tradução ou resposta única por si só. O programa verifica o registro da revisão, sem acessar a referência, identificar automaticamente o idioma do texto ou substituir a decisão editorial. Datas são validadas como calendário, sem depender do relógio da compilação. Tradução pendente, revisão ausente, confirmação incompleta e registros rejeitados não geram conteúdo jogável.

### Artefatos e relatórios

`data/questions/published/catalog.json` é um único artefato privado, com `schemaVersion: 1`, perguntas aprovadas completas, atribuições das fontes utilizadas e manifesto embutido. O manifesto contém quantidade, disponibilidade por tema/dificuldade e SHA-256 do conteúdo canônico. Cada pergunta conserva gabarito, procedência e revisão; cada fonte utilizada inclui título, URL, licença, texto de atribuição/licença e seu hash. Quebras de linha de licenças são normalizadas para LF, preservando o texto e evitando divergência entre Windows e Linux.

A compilação ordena IDs, fontes e chaves por regra explícita, sem timestamp ou caminho absoluto na saída. Não modifica IDs editoriais nem embaralha alternativas; a [seleção privada da T12](selecao-de-perguntas.md) faz essa preparação por partida. IDs e enunciados aprovados duplicados causam falha na publicação, sem escolha automática entre registros. A normalização detecta repetições literais; equivalência por sentido ainda exige revisão.

`data/publication-reports/questions.json` registra candidatos ignorados, registros revisados, exclusões por status, rejeições estruturais, duplicatas, erros e disponibilidade da tentativa. `publishable: false` indica que a tentativa falhou; os números desse relatório não substituem o manifesto do catálogo anteriormente publicado. Registros não aprovados são excluídos mesmo quando malformados; `questions:validate` também aponta esses erros para correção editorial. Um registro que tenta ser aprovado com gabarito/revisão/procedência inválidos faz a publicação terminar com código diferente de zero.

Só depois de validar tudo, a publicação substitui `catalog.json` por renomeação de arquivo temporário no mesmo diretório. Uma tentativa inválida atualiza o diagnóstico e preserva os bytes do último catálogo válido. `questions:check` recompila em memória, confere os bytes de catálogo/relatório e falha se houver divergência, sem escrever arquivos. A CI executa esse check; não publica nem aprova conteúdo automaticamente.

### Carregamento no servidor

`LocalQuestionRepository` carrega apenas o arquivo publicado antes de aceitar requisições, sem ler candidatos, acessar referências ou fazer consultas externas durante o jogo. Arquivo ausente, JSON inválido, formato/manifesto/hash divergentes, atribuição inválida ou tamanho acima de 32 MiB impedem a inicialização. O erro aponta a verificação editorial sem imprimir perguntas/gabaritos ou o caminho privado.

A porta `QuestionRepository` oferece somente `list({ category?, difficulty? })` e `availability()`. As consultas usam memória e devolvem cópias; alterações do consumidor não afetam o catálogo. O caminho padrão é relativo ao módulo, funcionando em código fonte e compilado mesmo fora do diretório do projeto. Testes podem injetar repositório ou caminho local. Não há endpoint público de catálogo. Dados e schemas editoriais não entram em shared, `apps/web/public` ou bundle web; o Vite também bloqueia arquivos editoriais/servidor pela rota de desenvolvimento `/@fs`.

Após publicar um novo catálogo, reinicie o servidor para carregá-lo. Não há recarga automática nem substituição de conteúdo no meio de uma partida.

### Lote inicial publicado — T11

Em 17/10/2026, a primeira publicação continha **72 perguntas aprovadas em pt-BR**, com **12 por tema: seis fáceis, quatro médias e duas difíceis**. Os seis temas são artes e literatura, geografia, história, cultura pop, ciência e natureza e esportes. As referências e decisões individuais estão em [`data/publication-reports/t11-editorial.json`](../data/publication-reports/t11-editorial.json); o [relatório editorial](revisao-editorial-t11.md) explica o método e os limites.

Esse estoque permitia um aquecimento isolado com **três fáceis e três médias**, conforme a proposta do plano. A [T12](selecao-de-perguntas.md) implementou posteriormente seleção sem reposição, mistura de dificuldades e IDs públicos. A classificação de dificuldade é editorial e provisória, sem calibração com jogadores.

Os **1.531 candidatos originais permaneceram inalterados**: 531 em pt-BR com `needs-review` e 1.000 em inglês com `needs-translation`. Na T11, a aprovação ficou apenas nas 72 cópias revisadas. O lote inicial não cobria uma partida completa com doze jogadores, as 300 perguntas da T27 ou as 5.000 da T33. A publicação atual está descrita a seguir.

### Expansão publicada — T27

Esta seção registra a publicação de 20/10/2026. Desde a T33, os experimentos históricos `questions:simulate`, `questions:simulate:classic` e `pilot:simulate` reproduzem o snapshot privado original em `data/editorial-baselines/t27-catalog.json`. A capacidade da publicação atual é verificada por `questions:capacity`.

A publicação de **20/10/2026** amplia o lote da T11 para **300 perguntas aprovadas em pt-BR**: 50 em cada tema, com 15 fáceis, 20 médias e 15 difíceis. As 72 anteriores permanecem intactas; foram acrescentadas 228 cópias revisadas de candidatos Questionados, sob a mesma licença MIT. Não há novas importações nem traduções do Open Trivia DB nesta entrega. Os candidatos e `data/sources.json` conservam os hashes registrados na T11.

O [relatório editorial da T27](revisao-editorial-t27.md) registra a revisão, amostras cruzadas por tema/dificuldade e os limites de diversidade/calibração. [t27-editorial.json](../data/publication-reports/t27-editorial.json) guarda cada decisão com antes/depois, referência, data e justificativa. Esse lote substitui a contagem atual do lote inicial descrito acima.

`pnpm questions:simulate` gera [t27-stock.json](../data/publication-reports/t27-stock.json), usando o mesmo seletor e os parâmetros experimentais do servidor. São 66 percursos com 2–12 participantes, duas sementes e três formas de escolha; a verificação percorre cinco fases, conserva as 50 da final, continua até esgotar as fáceis e confirma ausência de repetição. Também registra a admissão de todos os 693 subconjuntos de temas/tamanhos de grupo. `--check` compara os bytes sem escrever; a CI executa essa verificação.

O orçamento completo exige ao menos três temas deste catálogo: com apenas dois, há 30 fáceis e são necessárias 34, incluindo as 25 reservadas. A dinamite proposta usa um ciclo médio e um difícil; duplicar ambos para doze pessoas exigiria 24 médias e 24 difíceis em um único tema, acima do estoque. Dificuldades não são convertidas para esconder falta de conteúdo. A T27 habilita o conteúdo para esse orçamento; a sequência jogável completa e D02–D06 continuam nas respectivas tarefas. Após publicar, reinicie o servidor para carregar o novo catálogo.

### Expansão em andamento — T33

Em 23/10/2026, a publicação tem **348 aprovadas**, 58 por tema, após os lotes `t33-001` e `t33-002`. As 300 anteriores foram preservadas; 48 aprovações e 14 rejeições estão registradas nos lotes com versões anterior/revisada, referências, justificativas e comparação semântica. A revisão foi assistida por IA, sem auditoria humana independente. Faltam 4.652 aprovações para a meta de 5.000.

A coleta contém 5.761 candidatas, sendo 5.230 do Open Trivia DB e 531 do Questionados. Dessas, 5.399 continuam sem decisão e ficam fora da publicação. Os primeiros mil registros do Open Trivia DB e o manifesto histórico são conferidos contra os hashes originais da T27; novas coletas podem acrescentar registros sem alterar essa evidência. Consulte a [distribuição atual, os lotes e seus limites](expansao-editorial-t33.md).

`pnpm questions:audit --check` reproduz a auditoria de histórico/publicação; `--batch=t33-002` verifica o comprovante daquele lote dentro do histórico global. `pnpm questions:capacity --check` reproduz a capacidade do catálogo atual. Os arquivos privados de toda a pasta `data`, incluindo lotes e snapshots com gabaritos, são bloqueados pelo Vite em `/@fs`.
