# T17 — Primeiro marco jogável e smoke test

- **Depende de:** [T11](./T11-primeiro-lote-editorial.md), [T16](./T16-quiz-classico-web.md)
- **Pacotes:** e2e, web, server, data
- **Marco:** M2
- **Branch sugerido:** `task/17-primeiro-marco-jogavel`

O status desta tarefa fica somente no [índice](README.md). Implementação e evidências estão registradas abaixo.

## Objetivo

Comprovar o fluxo real de perfil, sala e quiz clássico antes de ampliar o jogo.

## Leia antes

- [planejamento.md](../planejamento.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Entregáveis

- [x] Configurar Playwright com duas identidades independentes e dados revisados do lote inicial.
- [x] Cobrir criar sala, convidar, editar perfil, responder, revelar, mostrar placar e retornar ao lobby no protótipo curto.
- [x] Produzir roteiro de teste manual e registrar falhas encontradas com resultado esperado.
- [x] Adicionar o smoke test à CI em ambiente isolado, com porta e ciclo de vida controlados.

## Critérios de aceite

- [x] O percurso funciona com servidor e navegador reais, sem mockar pontuação ou mensagens de sala.
- [x] Um reload preserva a identidade; a segunda aba não cria um participante duplicado.
- [x] Não depende de chamada externa de perguntas nem de candidatos não aprovados.
- [x] O marco é anunciado como quiz clássico de teste, não como PENSHOW completo.

## Verificação

- [x] Executar smoke test e roteiro de inspeção em computador e celular emulado, com automação e revisão visual das capturas; não houve teste em aparelho físico.
- [x] Simular resposta simultânea entre duas pessoas e conferir pontos e gabarito sem vazamento.

## Implementação e evidências

`e2e/` configura Playwright Test **1.64.1**, com dois contextos independentes, Chromium e projetos desktop **1280×900** e móvel **360×780** com toque emulado. Cada percurso inicia o aplicativo real em `NODE_ENV=test`, backend em porta atribuída pelo sistema e Vite Preview do build em porta estrita **4179**, configurável por ambiente. As fixtures fecham navegadores, aplicativo, salas/timers e preview; não reutilizam servidores abertos nem adicionam rotas de teste. O término da matriz deixou a porta de preview sem listener.

Os perfis, criação, convite, entrada, edição/aplicação de nome e personagem e início do quiz passam pela interface. Recarga no lobby conserva os IDs; outra aba do mesmo contexto substitui a conexão sem criar terceiro participante. A recarga após responder conserva a resposta bloqueada e o prazo original. O percurso também confere cópia/fallback do convite e cancelamento do diálogo de saída por Escape com restauração do foco.

Cada partida usa seis perguntas locais aprovadas, distintas, três fáceis/três médias. Há acertos, erros, ausência e envios concorrentes das duas identidades, com tempo oficial. O teste consulta o gabarito somente no processo Node para escolher uma alternativa já visível; avaliação e placar são do servidor. As duas telas confirmam **500/200 pontos**, **5/2 acertos**, revelação/explicação, conclusão do protótipo e retorno conjunto ao lobby. A auditoria passiva de polling/WebSocket valida envelopes estritos e as sete etapas: leitura sem alternativas, nenhum gabarito antecipado ou campo privado nas visões e nenhuma requisição HTTP externa.

Verificação executada em **19/10/2026**, no Windows:

- `pnpm test:e2e`: catálogo e build aprovados; **2 smokes aprovados em 2,6 minutos**, desktop e celular emulado, sem retry. Um percurso desktop anterior também passou.
- `pnpm test`: **576 testes** aprovados — servidor **281**, shared **162**, web **96**, conteúdo **32** e artes **5**.
- `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm questions:check`, `pnpm questions:validate`, `pnpm avatars:check` e `git diff --check`: aprovados.
- Catálogo íntegro com **72 aprovadas** e **1.531 candidatas excluídas** da publicação; nenhuma pergunta foi alterada.
- Capturas reais de conclusão/placar desktop e móvel inspecionadas: resultado legível, jogadores preservados e ausência de transbordamento da página. O relatório local em `e2e/playwright-report/` anexa capturas e resumo sem credenciais; falhas preservam trace/capturas. Não houve nova falha funcional reproduzida na matriz final.

O [roteiro de inspeção](../teste-manual-m2.md) registra M01–M17, resultados esperados e duas ocorrências corrigidas no harness: tipagem do encerramento do Vite e ordem de espera da leitura nas duas telas. A execução foi assistida por automação e revisão de capturas, sem teste humano em aparelho físico. O [guia do smoke](../smoke-m2.md) descreve reprodução, isolamento e diagnóstico.

A CI recebeu o job `smoke`, dependente de `quality`, com Chromium correspondente ao lockfile, build real e artefatos por sete dias. Teste focado ou instável após retry reprova a CI. Os comandos foram exercitados localmente; o job hospedado ainda não foi executado, pois não houve commit/push. Sem deploy, outras modalidades ou anúncio de partida completa; decisões pendentes permanecem como registradas.

## Cuidados de implementação

Este marco não depende de ter milhares de perguntas prontas. Não usar sleeps longos como substituto de esperar estados observáveis.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
