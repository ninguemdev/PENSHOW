# T20 — Modalidade de roubo de pontos

- **Depende de:** [T17](./T17-primeiro-marco-jogavel.md), [T13](./T13-pontuacao-e-parametros.md)
- **Pacotes:** server, web, shared
- **Marco:** M3
- **Branch sugerido:** `task/20-fase-roubo`

O status desta tarefa fica somente no [índice](README.md). O protótipo e suas evidências estão descritos abaixo e no [guia de roubo](../roubo.md). D05 foi respondida e aplicada em 23/10/2026: teto 100, crédito de 100 para todos os acertos e direito exclusivo do primeiro acerto.

## Objetivo

Adicionar interação por transferência de pontos com direito ao roubo explícito e saldo consistente.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [decisoes.md](../decisoes.md)

## Decisão confirmada em 23/10/2026

D05 confirma o direito exclusivo do primeiro acerto, mantendo +100 para todos os acertos e aumentando o roubo para até **100 pontos**, limitado ao saldo do alvo após os créditos. A configuração padrão usa 100 com política `confirmed`. As evidências do protótipo de 19/10/2026, abaixo, usam 50 e permanecem históricas.

## Entregáveis

- [x] Implementar o direito ao roubo conforme D05 e preservar +100 para cada resposta correta.
- [x] No formato proposto, identificar a primeira resposta correta depois de fechar as respostas e abrir seis segundos de alvo.
- [x] Atualizar o teto para 100: transferir o mínimo entre 100 e o saldo do alvo após creditar os acertos; sem alvo ou escolha, não transferir. O protótipo de 50 foi validado anteriormente.
- [x] Atualizar parâmetros, projeções, exemplos e testes de serviço/rede/web/e2e; preservar conservação dos pontos, limite pelo saldo e aplicação única.
- [x] Exibir autor, alvo, valor efetivo e decomposição do saldo; atualizar protocolo da escolha de alvo.

## Critérios de aceite

- [x] Mais rápido errado não bloqueia um acerto posterior nesta fase; isso difere da final.
- [x] Somente ator autorizado escolhe alvo; não escolhe a si mesmo nem participante inexistente.
- [x] Transferência não cria pontos e nunca deixa o alvo negativo.
- [x] A view não revela o primeiro acerto enquanto houver respostas abertas.

## Verificação

- [x] Testar primeira resposta errada, dois acertos concorrentes e ausência de acertos.
- [x] Testar alvo com 30, saldo atualizado após acerto, escolha tardia e ataque reenviado.

## Implementação e evidências do protótipo

`theftStrategy` calcula os créditos por acerto uma vez; o motor aplica a base ao fechar as respostas e guarda a resolução pendente em `theft-target-selection`. Só a primeira resposta correta na ordem da fila recebe seis segundos de alvo. `settleTarget` acrescenta somente a transferência limitada ao saldo após os acertos, e a revelação confirma uma resolução completa no histórico. Sem acerto, adversário com saldo ou escolha no prazo, não transfere. Esse é o protótipo `first-correct-only`, sem aprovação implícita de D05.

`match:start` aceita `theft` apenas em desenvolvimento/teste; o plano isolado usa seis perguntas aprovadas inéditas, duas por dificuldade. `target:choose` verifica sessão/conexão, membro, contexto, fase, direito ao roubo, alvo e prazo na fila. Não executa ataque de vidas. Reenvio não reaplica transferência; falha pré-commit preserva créditos e escolha pendente; reconexão mantém direito e prazo.

`MatchView.theftRules` publica os parâmetros e a política de protótipo. O autor não aparece durante respostas abertas. Após fechá-las, a view oferece adversários com saldo atualizado, e só o autor vê botões. A revelação informa autor, alvo, valor efetivo e decomposição de saldo/acerto/transferência. A UI usa números recebidos e bloqueia escolha incerta até recuperar a fotografia. Schema público confere participantes, transferência com sinal e saldo final.

Os testes cobrem erro mais rápido, acertos no mesmo milissegundo nas duas ordens, envios concorrentes, ausência de acertos, alvo com 30, crédito antes do roubo, ator/alvo/prazo inválidos, timeout sem alvo, reenvio, reconexão, falha da transferência e timer antigo. Socket.IO real cobre WebSocket/polling, espectador, outra identidade e campos extras, com liquidação **150/50**. O serviço percorre seis perguntas e termina em **400/400**, com **4/4 acertos**, sem resolver uma pergunta duas vezes.

Verificações locais em **19/10/2026**, no Windows:

- `pnpm test`: **623 testes aprovados** — servidor **317**, shared **164**, web **105**, conteúdo **32** e artes **5**.
- `pnpm test:e2e:run`, após build: **8 percursos aprovados em 10,6 minutos**, sem retry — clássico, velocidade, roubo e aposta em desktop **1280×900** e celular **360×780** emulado. O roubo concluiu seis perguntas em **400/400 pontos** e **4/4 acertos** nas duas resoluções, com erro rápido, nenhum acerto, timeout sem alvo, troca de autor, recarga preservando direito/prazo e retorno ao lobby. Auditoria sem autor antecipado, gabarito fora da revelação, campos privados ou requisições externas.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` e `git diff --check`: aprovados.

As capturas reais da transferência desktop/móvel foram inspecionadas: autor, alvo, valor e decomposição legíveis, sem transbordamento da página. O relatório local anexa essas capturas em `e2e/playwright-report/`; o job `smoke` descobre os oito percursos e conserva o artefato `smoke-modalidades`, agora com limite de 20 minutos. Não houve teste em aparelho físico.

Na implementação histórica descrita acima, D05 foi reapresentada e permaneceu sem resposta. Em 23/10/2026, o usuário confirmou primeiro acerto e teto de 100; a consolidação e as evidências do novo teto constam na seção seguinte. As evidências anteriores não incluíram commit, push, deploy ou CI hospedada, nem alteração editorial.

## Consolidação D05 — 23/10/2026

O padrão congelado de roubo agora usa base **100**, teto **100**, direito exclusivo do primeiro acerto e política **confirmed**. O contrato público aceita essa confirmação e a projeção deriva o marcador das regras da partida. A configuração experimental continua identificada separadamente: a variante de teto 25 do piloto permanece **prototype**. Nenhum cliente envia o valor a transferir.

Os cálculos continuam creditando todos os acertos antes de transferir. A matriz adicional cobre saldo 0/30/99/100/101, alvo correto ou errado e conservação do total: saldo 30 com erro cede 30; saldo 30 com acerto chega a 130, cede 100 e termina em 30. Dois acertos a partir de zero terminam em **200/0**. Serviço, rede e interface foram atualizados para 100; reconexão, rollback, autorização, prazo e reenvio conservam uma liquidação.

Verificações locais, no Windows:

- **901 testes aprovados** em `pnpm test`: servidor **482**, shared **192**, web **179**, conteúdo **43** e artes **5**.
- **6 percursos Playwright aprovados em 5,4 minutos**, sem retry: `theft-smoke.spec.ts` e `classic-mode.spec.ts`, em desktop **1280×900** e celular **360×780** emulado. Cobrem roubo isolado e integrado, crédito de todos os acertos, transferência de 100, conservação, erro rápido, nenhum acerto, timeout sem transferência, troca de autor, recarga preservando prazo, final e revanche. O isolado termina em **400/400**, com **4/4 acertos**. Capturas desktop/móvel inspecionadas com valor e decomposição legíveis; a tabela móvel mantém rolagem interna.
- `pnpm pilot:simulate`: **60/60 percursos completos**, com **2/4/8/12 participantes**. [Relatório T20](../../data/publication-reports/t20-group-pilot.json) separado dos históricos T32/T39, com parâmetros e hashes atuais. Conferência adicional do JSON validou todas as conclusões, conservação dos pontos por fase, saldos não negativos, base 100 e teto/status de cada configuração (100/confirmed, ou 25/prototype na comparação). A reprodução determinística do percurso também passou na suíte do servidor; o `--check` integral do piloto não foi repetido nesta execução.
- `pnpm questions:simulate:classic --check`: **120 sequências**, **480 percursos**, **1.260 configurações**, nenhuma pergunta repetida; relatório histórico de estoque reproduzido sem alteração.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format:check` e `git diff --check`: aprovados.

Não houve teste em aparelho físico ou avaliação humana de equilíbrio. A aplicação permanece em desenvolvimento/teste; publicação fica por último em T35, após a VM.

## Cuidados de implementação

Se D05 mudar para vários ladrões, atualizar a política de resolução e os exemplos antes de implementar essa variante. Não misturar política de roubo de pontos com ataque de vidas.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
