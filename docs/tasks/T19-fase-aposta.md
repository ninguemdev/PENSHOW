# T19 — Modalidade de aposta

- **Depende de:** [T17](./T17-primeiro-marco-jogavel.md), [T13](./T13-pontuacao-e-parametros.md)
- **Pacotes:** server, web, shared
- **Marco:** M3
- **Branch sugerido:** `task/19-fase-aposta`

O status desta tarefa fica somente no [índice](README.md). O comportamento implementado está no [guia de aposta](../aposta.md); as evidências de execução ficam abaixo.

## Objetivo

Entregar escolha de risco antes da pergunta, com saldo e apostas protegidos pelo servidor.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Criar subestado de aposta antes de cada enunciado, com tema, dificuldade e janela proposta de seis segundos.
- [x] Validar escolhas 0 / 25 / 50 cobertas pelo saldo e assumir zero em ausência de escolha.
- [x] Resolver acerto como +100 + aposta; erro ou ausência como perda apenas da aposta.
- [x] Construir controle acessível de aposta, confirmação e revelação individual do efeito no saldo.

## Critérios de aceite

- [x] Aposta de outro participante e enunciado não vazam antes do fim da etapa de aposta.
- [x] Saldo insuficiente não permite comprometer pontos inexistentes; escolha zero mantém direito de responder.
- [x] Reconectar recupera aposta aceita sem reapostar; repetir ação não debita duas vezes.

## Verificação

- [x] Testar saldo 0, 25 e 50; aposta acima do saldo; prazo e estado inválidos.
- [x] Conferir exemplos 500 → 650 no acerto com 50 e 500 → 450 no erro, além de aposta ausente.

## Cuidados de implementação

A estratégia calcula os efeitos; o serviço os aplica uma vez. UI não deve manter um saldo alternativo ao enviado na view.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Implementação e evidências

`wagerStrategy` reutiliza os cálculos puros da T13. O motor abre `wager-selection` antes de cada enunciado por seis segundos completos, sela uma escolha válida por participante e assume zero para escolhas ausentes. Não há desconto antecipado; o fechamento da pergunta confirma os efeitos uma vez junto ao placar/histórico. Mesma escolha repetida é no-op, alteração é `ACTION_CONFLICT`, aposta acima do saldo é `INSUFFICIENT_BALANCE` e prazo exato é recusado.

O modo `wager` pode ser iniciado pelo anfitrião no lobby, somente em desenvolvimento/teste. São seis perguntas inéditas aprovadas, duas por dificuldade, sem reserva da final. O saldo começa em zero e os acertos anteriores permitem apostar nas perguntas seguintes; não há saldo injetável pelo comando público. As regras continuam experimentais e D01–D06 permanecem pendentes.

`wager:submit` usa sessão/conexão atuais e contexto completo na fila da sala. As projeções usam `ownWager` durante aposta, leitura e resposta, com opções cobertas pelo saldo de cada destinatário; espectadores não apostam. Enunciado e alternativas ficam ausentes na escolha; valores dos adversários só aparecem em `reveal.wagerResults`, com saldo anterior/atual. Reconexão conserva aposta e prazos. `WagerSelection` oferece botões nativos, confirmação de envio, bloqueio de duplicatas e recuperação após timeout, sem saldo alternativo local.

Testes de domínio cobrem saldos **0/25/50**, opções inválidas/insuficientes, prazo/fase/contexto/ator, imutabilidade, repetição, privacidade e **500→650/450**, inclusive ausência de aposta/resposta. O serviço percorre seis perguntas com saldo zero e termina em **850/0** no cenário controlado, além de testar concorrência e reconexão. Socket.IO real cobre WebSocket/polling, espectador, outra identidade, campos privados injetados, reconexão e liquidação **250/75** após apostas diferentes. A web cobre teclado, confirmação, opções/saldo, recuperação e revelação de ganhos/perdas.

Verificações executadas em **19/10/2026**, no Windows:

- `pnpm test`: **609 testes aprovados** — servidor **306**, shared **164**, web **102**, conteúdo **32** e artes **5**.
- `pnpm test:e2e:run`, após build: **6 percursos aprovados em 8,3 minutos**, sem retry — clássico, velocidade e aposta em desktop **1280×900** e celular **360×780** emulado. A aposta concluiu seis perguntas com **425/325 pontos** e **4/3 acertos** nas duas telas, cobrindo escolhas 0/25/50, aposta ausente, resposta ausente, recarga com escolha bloqueada/prazo preservado, revelação de saldos e retorno conjunto ao lobby. A auditoria não encontrou campos privados ou requisições externas. Capturas reais de conclusão/placar desktop e móvel foram inspecionadas, com resultado legível e sem transbordamento da página; tabela conserva sua rolagem interna.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` e `git diff --check`: aprovados.

O percurso de navegador de aposta está integrado à descoberta automática dos dois projetos Playwright e ao job `smoke`, cujo limite passou para 15 minutos para comportar as três modalidades com seus tempos reais. O artefato passa a `smoke-modalidades`, com capturas e resumo de aposta. Não houve execução hospedada da CI, commit, push ou deploy nesta tarefa. Nenhuma pergunta editorial foi modificada; testes móveis usam emulação, não aparelho físico.
