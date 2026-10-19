# T14 — Motor comum da partida e das fases

- **Depende de:** [T08](./T08-salas-realtime-e-projecao.md), [T12](./T12-selecao-de-temas-e-perguntas.md), [T13](./T13-pontuacao-e-parametros.md)
- **Pacotes:** server, shared
- **Marco:** M2
- **Branch sugerido:** `task/14-motor-comum-de-partida`

O status desta tarefa fica somente no [índice](README.md). Implementação e evidências estão registradas abaixo.

## Objetivo

Orquestrar fases por uma máquina de estados pura, mantendo serviços, efeitos e transporte separados.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Entregáveis

- [x] Criar agregado de partida, estados discriminados e contrato pequeno de estratégia de modalidade.
- [x] Modelar início, instruções, escolha de tema, leitura, resposta, revelação e resultado de fase.
- [x] Executar efeitos e timers na fila da sala, com IDs de partida/fase/pergunta, relógio e agendador injetados.
- [x] Congelar participantes/configuração e emitir visões atualizadas após transições aceitas.

## Critérios de aceite

- [x] Timer atrasado de outra pergunta ou partida não avança a atual.
- [x] Troca de modalidade ocorre pelo registro de estratégias; não há switch de regra espalhado por handler e componente.
- [x] Uma falha de processamento não reaplica pontuação nem bloqueia a sala.
- [x] Máquina pode operar com só a modalidade clássica no primeiro protótipo, sem simular modalidades não implementadas.

## Verificação

- [x] Testar transições válidas/inválidas, prazo exato, todos responderam e próximo passo agendado.
- [x] Testar cancelamento de timer, ordem de efeitos, comando repetido e encerramento da partida.

## Implementação e evidências

Implementado em `apps/server/src/modules/matches/`: agregado/reducer puro, `StrategyRegistry`, contrato pequeno de estratégia, resolução clássica, serviço na fila da sala e projeção explícita. `MatchSession` guarda estado e checkpoint privado da seleção; falhas descartam os dois. A sala protege elenco/regras/plano e confirma uma versão por mutação. O hook de ciclo agenda o próximo timer antes da publicação, com validação de contexto e revisão ao executar.

O ciclo inclui instruções, tema com fallback no prazo, leitura, respostas definitivas, revelação, resultado e `prototype-complete`. A união pública ganhou essa conclusão aditiva, sem ranking/vidas/vencedor. Só a estratégia clássica está instalada. A integração de `app.ts` e dos handlers com sessões Socket.IO pertence à T15; a web permanece no lobby. Detalhes em [motor-de-partida.md](../motor-de-partida.md).

Verificação executada em 19/10/2026:

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` e `git diff --check`: aprovados.
- `pnpm test`: conteúdo **32**, artes **5**, servidor **262** e web **75** aprovados; shared **160** após executar também sua suíte com o novo caso de conclusão. Total: **534 testes**, sem skips/todos.
- Motor: **37 testes novos** de domínio/serviço, incluindo transições, estratégia seguinte registrada em fixture, limites de prazo, concorrência, callbacks antigos, repetição, rollback de conteúdo e placar, nova tentativa de timer, falha de publicação, autenticação na fila e projeções por destinatário. Shared acrescenta um caso de contrato público.
- `pnpm questions:check` e `pnpm questions:validate`: catálogo privado íntegro, **72 aprovadas** e **1.531 candidatas excluídas** da publicação.
- `pnpm build`: shared, servidor e web compilados; suporte/fixtures dos testes permanecem fora do build de produção.
- Smoke com módulos compilados, `LocalQuestionRepository`, `RoomService`, `MatchService`, publicador existente, IDs/sorteio criptográficos e relógio/agendador controlados: catálogo real de **72**, **6 perguntas distintas**, mistura **3 fáceis/3 médias**, placar **600/0**, **6 resoluções**, **61 visões validadas** e conclusão explícita do protótipo. **6 callbacks cancelados** foram executados depois da conclusão sem alterar a versão. Fechamento deixou **zero timers pendentes**. Eventos não continham fonte, IDs editoriais, mapa privado, recibos ou checkpoint.

Não houve commit, push ou deploy. As decisões D01–D06 continuam em consulta; não foram implementadas final, outras modalidades ou interface de jogo.

## Cuidados de implementação

Não criar microsserviços, barramento de eventos ou hierarquia genérica sem uso. Final terá domínio próprio e será incorporada pela T23.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
