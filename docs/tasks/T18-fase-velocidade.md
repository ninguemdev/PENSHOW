# T18 — Modalidade de velocidade

- **Depende de:** [T17](./T17-primeiro-marco-jogavel.md)
- **Pacotes:** server, web, shared
- **Marco:** M3
- **Branch sugerido:** `task/18-fase-velocidade`

O status desta tarefa fica somente no [índice](README.md). A implementação e a execução estão documentadas abaixo e no [guia da modalidade](../velocidade.md).

## Objetivo

Adicionar o bônus por faixas de tempo com cálculo oficial no servidor e explicação na interface.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)

## Entregáveis

- [x] Implementar estratégia de seis perguntas com +100 de base e bônus propostos de +50 / +25 / 0.
- [x] Usar recepção no servidor, intervalos [0,5), [5,10), [10,15) e rejeição no prazo final.
- [x] Criar instrução e revelação do bônus por faixa, reutilizando a tela comum de pergunta.
- [x] Registrar a estratégia no motor e ampliar contratos, CI e testes da modalidade.

## Critérios de aceite

- [x] Erro rápido continua valendo zero; ninguém ganha bônus por somente clicar primeiro.
- [x] Valores de regra não são duplicados no cliente; a tela explica base, bônus e total.
- [x] Relógio adulterado no cliente não altera o resultado; ajuste de exibição não modifica o prazo.

## Verificação

- [x] Testar 4,999 s, 5 s, 9,999 s, 10 s e prazo de 15 s com relógio controlado.
- [x] Validar dois jogadores com a mesma faixa, erro em 2 s e reconexão após resposta.

## Implementação e evidências

`speedStrategy` usa o cálculo puro da T13 e é instalada no registro real do `MatchService`. `match:start` aceita `mode` opcional (`classic`/`speed`); o modo omitido conserva clássico. O modo escolhido é congelado no elenco. O seletor prepara `speed-prototype` com duas fáceis, três médias e uma difícil; falta de pergunta difícil impede iniciar. Os dois protótipos continuam restritos a desenvolvimento/teste. A sequência completa e a final não fazem parte desta entrega.

`MatchView.speedRules` publica somente base, prazo e faixas congeladas; os schemas estritos validam faixas e sua presença na velocidade. `CommonRound` compartilha o fluxo de pergunta com clássico, e `SpeedRules` explica as faixas recebidas. A revelação apresenta base/bônus/total de cada participante pelos efeitos confirmados. Não há parâmetro de pontos ou relógio no comando de resposta. Ajustes visuais não modificam `opensAt` ou `deadlineAt` no servidor.

Os testes de serviço verificam **4.999 → 150**, **5.000 → 125**, **9.999 → 125**, **10.000 → 100**, **14.999 → 100** e **15.000 ms → recusa**, com dois jogadores na mesma faixa. Erro em dois segundos vale zero. Reconexão recupera resposta bloqueada e prazo original, sem nova resolução; seis perguntas inéditas produzem **900/0** no cenário de acerto rápido/erro. Mudança na configuração de origem após início não altera a partida.

Socket.IO real cobre WebSocket e polling, recusa `receivedAt` injetado, substitui conexão após resposta e confirma **125/125** e bônus **25/25** recebidos na segunda faixa, sem vazamento. O teste web usa parâmetros diferentes dos padrões (**base 175, bônus 60 e limite 4 s**) e confere o total **235**, mostrando que os valores não estão fixados no cliente.

Verificações executadas em **19/10/2026**, no Windows:

- `pnpm test`: **590 testes aprovados** — servidor **292**, shared **164**, web **97**, conteúdo **32** e artes **5**.
- `pnpm test:e2e:run`, após `pnpm build`: **4 percursos aprovados em 4,6 minutos**, sem retry — clássico e velocidade, desktop **1280×900** e celular **360×780** emulado. Cada percurso de velocidade usa duas identidades, seis perguntas reais aprovadas, recarga após resposta, bônus/placar nas duas telas, conclusão e retorno ao lobby. Os acertos finais são **6/3**; valores de bônus seguem o recebimento real. As auditorias não identificaram gabarito antecipado, recibos privados ou requisições externas. Não houve teste em aparelho físico.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` e `git diff --check`: aprovados.

O job `smoke` existente descobre automaticamente o novo percurso nos dois projetos, depois de `quality`; os artefatos passam a `smoke-classico-e-velocidade`. Não houve execução hospedada da CI, commit, push ou deploy nesta tarefa. Nenhuma pergunta editorial foi modificada. D01 e as outras consultas continuam pendentes; pontos e tempos permanecem experimentais.

## Cuidados de implementação

Usar os padrões propostos como parâmetros e incorporar D01 quando resolvida. Se o lote inicial não cobrir uma partida longa, testar a estratégia com fixtures isoladas; T27 habilita o conteúdo amplo.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
