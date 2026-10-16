# T17 — Primeiro marco jogável e smoke test

- **Depende de:** [T11](./T11-primeiro-lote-editorial.md), [T16](./T16-quiz-classico-web.md)
- **Pacotes:** e2e, web, server, data
- **Marco:** M2
- **Branch sugerido:** `task/17-primeiro-marco-jogavel`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Comprovar o fluxo real de perfil, sala e quiz clássico antes de ampliar o jogo.

## Leia antes

- [planejamento.md](../planejamento.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Entregáveis

- [ ] Configurar Playwright com duas identidades independentes e dados revisados do lote inicial.
- [ ] Cobrir criar sala, convidar, editar perfil, responder, revelar, mostrar placar e retornar ao lobby no protótipo curto.
- [ ] Produzir roteiro de teste manual e registrar falhas encontradas com resultado esperado.
- [ ] Adicionar o smoke test à CI em ambiente isolado, com porta e ciclo de vida controlados.

## Critérios de aceite

- [ ] O percurso funciona com servidor e navegador reais, sem mockar pontuação ou mensagens de sala.
- [ ] Um reload preserva a identidade; a segunda aba não cria um participante duplicado.
- [ ] Não depende de chamada externa de perguntas nem de candidatos não aprovados.
- [ ] O marco é anunciado como quiz clássico de teste, não como PENSHOW completo.

## Verificação

- [ ] Executar smoke test e teste manual em computador e celular.
- [ ] Simular resposta simultânea entre duas pessoas e conferir pontos e gabarito sem vazamento.

## Cuidados de implementação

Este marco não depende de ter milhares de perguntas prontas. Não usar sleeps longos como substituto de esperar estados observáveis.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
