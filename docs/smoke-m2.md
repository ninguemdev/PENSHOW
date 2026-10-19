# Smoke do quiz clássico de teste

A T17 adiciona `@penshow/e2e`, com Playwright Test **1.64.1** e Chromium. O percurso começa sem perfil ou sessão salvos, usa o build real da web, o aplicativo Fastify/Socket.IO e o catálogo publicado da T11. Não modifica pontuação, não injeta visões e não acrescenta rotas de teste ao produto. Este é o primeiro marco do **quiz clássico de teste**, com uma fase/seis perguntas, sem anunciar o PENSHOW completo.

## Executar

Com Node 24 e as dependências instaladas:

```sh
pnpm --filter @penshow/e2e exec playwright install chromium
pnpm test:e2e
```

`test:e2e` confere o catálogo, compila os três pacotes do aplicativo e executa os dois projetos: desktop **1280×900** e móvel **360×780**, com toque emulado. Usa os tempos reais do protótipo, incluindo uma pergunta com ausência; cada projeto leva aproximadamente um minuto e meio. Não há `waitForTimeout` ou relógio acelerado.

Depois de compilar, `pnpm test:e2e:run` executa apenas o navegador. Para investigar um projeto:

```sh
pnpm --filter @penshow/e2e smoke --project=desktop
pnpm --filter @penshow/e2e smoke --project=mobile
pnpm --filter @penshow/e2e exec playwright show-report playwright-report
```

O relatório fica em `e2e/playwright-report/`, com capturas do resultado e resumo sem credenciais. Falhas também preservam trace e capturas; resultados transitórios ficam em `e2e/test-results/`. Ambos são ignorados por Git, Prettier e ESLint. Não são assets do produto.

## Isolamento e ciclo de vida

Cada teste inicia um servidor com `NODE_ENV=test` e porta de backend atribuída pelo sistema. O Vite Preview serve exclusivamente o build da web em `127.0.0.1:4179` e encaminha API/Socket.IO ao backend daquela execução. A origem permitida é exata. A porta de preview é estrita: uma ocupação falha, sem reaproveitar um aplicativo já aberto.

Para usar outra porta no PowerShell:

```powershell
$env:PENSHOW_E2E_PORT = '4189'
pnpm test:e2e
Remove-Item Env:PENSHOW_E2E_PORT
```

Os projetos rodam sequencialmente, com um worker. As duas identidades usam contextos independentes e preparam seus perfis pela interface; uma aba adicional do mesmo contexto testa a substituição de conexão. Fixtures encerram contextos, aplicativo, salas/timers e preview mesmo se o teste falhar. O próximo projeto inicia uma instância nova, sem salas ou credenciais da execução anterior.

O teste bloqueia requisições HTTP fora da origem local e reprova tentativas externas. Fontes, avatar, perguntas e scripts devem estar disponíveis no projeto. O aplicativo continua lendo apenas `published/catalog.json`; candidatos não são servidos nem carregados pelo teste de jogo.

## O que o percurso prova

`classic-smoke.spec.ts` cobre perfil/avatar, criação, convite, entrada da segunda pessoa, edição/aplicação do perfil, recarga do lobby, diálogo nativo com Escape e nova aba sem duplicar jogadores. Inicia o quiz, confirma prontidão e escolhe um tema oferecido.

Nas seis perguntas, verifica leitura sem alternativas, envio definitivo por teclado/toque, respostas simultâneas, acerto/erro/ausência, recarga após responder sem reiniciar o prazo, gabarito/explicação e placar oficial. Cada partida tem seis IDs distintos e distribuição 3 fácil/3 média. A sequência controlada de escolhas produz **500/200 pontos** e **5/2 acertos**, conferidos nas duas telas. O encerramento é `prototype-complete`; só o anfitrião retorna o grupo ao lobby.

Para escolher acerto/erro de forma reproduzível, apenas o processo Node do teste consulta o `PreparedQuestion` privado em memória. Ele escolhe o texto de uma opção já visível; não envia gabarito ao navegador nem calcula/substitui o resultado. Seleção, tempo, avaliação e crédito continuam no código oficial.

`public-audit.ts` observa passivamente eventos recebidos por polling e WebSocket, valida os envelopes e confere todas as etapas. Antes da revelação não pode haver gabarito/explicação; leitura não contém alternativas. Visões nunca incluem mapa editorial, fonte, recibos, token ou conexão privada. Respostas HTTP da API também são conferidas. A auditoria não altera transporte ou estado da UI.

## CI e diagnóstico

O job `smoke` em `.github/workflows/ci.yml` depende de `quality`, usa Ubuntu 24.04, instala o Chromium correspondente ao lockfile e executa o build/percurso em ambiente isolado. Anexa relatório e resultados por sete dias, inclusive em falhas. `forbidOnly` evita testes focados e uma execução instável após retry continua reprovando a CI.

A configuração e os comandos do job são verificados localmente; a execução hospedada ocorre quando o usuário publicar o branch. Esta tarefa não realiza commit, push ou deploy.

O [roteiro de inspeção](teste-manual-m2.md) registra ações, resultados esperados e execução desktop/móvel. A base da configuração segue a documentação oficial de [fixtures](https://playwright.dev/docs/test-fixtures), [TypeScript](https://playwright.dev/docs/test-typescript) e [CI](https://playwright.dev/docs/ci-intro). Testes de cinco modalidades/final, navegadores adicionais e grupos maiores pertencem aos marcos seguintes.
