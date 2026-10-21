# T20 — Modalidade de roubo de pontos

- **Depende de:** [T17](./T17-primeiro-marco-jogavel.md), [T13](./T13-pontuacao-e-parametros.md)
- **Pacotes:** server, web, shared
- **Marco:** M3
- **Branch sugerido:** `task/20-fase-roubo`

O status desta tarefa fica somente no [índice](README.md). O protótipo e suas evidências estão descritos abaixo e no [guia de roubo](../roubo.md). A consolidação permanece condicionada à resposta de D05.

## Objetivo

Adicionar interação por transferência de pontos com direito ao roubo explícito e saldo consistente.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [regras.md](../regras.md)
- [decisoes.md](../decisoes.md)

## Decisões em consulta

D05 define quem rouba. O plano de trabalho atual usa somente o primeiro acerto; confirmar a variante antes de consolidar esta modalidade, sem bloquear tarefas independentes.

## Entregáveis

- [ ] Implementar o direito ao roubo conforme D05 e preservar +100 para cada resposta correta.
- [x] No formato proposto, identificar a primeira resposta correta depois de fechar as respostas e abrir seis segundos de alvo.
- [x] Transferir mínimo de 50 e saldo disponível do alvo, após creditar os acertos; sem alvo ou escolha, não transferir.
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

D05 foi novamente apresentada durante esta implementação. Até chegar resposta, o primeiro entregável e a consolidação da modalidade permanecem abertos; o índice conserva T20 em andamento. Não houve commit, push, deploy ou execução hospedada da CI, e nenhuma pergunta editorial foi alterada.

## Cuidados de implementação

Se D05 mudar para vários ladrões, atualizar a política de resolução e os exemplos antes de implementar essa variante. Não misturar política de roubo de pontos com ataque de vidas.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
