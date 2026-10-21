# Smoke do quiz clássico de teste

A T17 adiciona `@penshow/e2e`, com Playwright Test **1.64.1** e Chromium. O percurso começa sem perfil ou sessão salvos, usa o build real da web, o aplicativo Fastify/Socket.IO e o catálogo publicado da T11. Não modifica pontuação, não injeta visões e não acrescenta rotas de teste ao produto. Este é o primeiro marco do **quiz clássico de teste**, com uma fase/seis perguntas, sem anunciar o PENSHOW completo.

## Executar

Com Node 24 e as dependências instaladas:

```sh
pnpm --filter @penshow/e2e exec playwright install chromium
pnpm test:e2e
```

`test:e2e` confere o catálogo, compila os três pacotes do aplicativo e executa os dois projetos: desktop **1280×900** e móvel **360×780**, com toque emulado. Usa os tempos reais do protótipo, incluindo uma pergunta com ausência; cada projeto leva aproximadamente um minuto e meio. Não há `waitForTimeout` ou relógio acelerado.

A [T18](velocidade.md) acrescentou `speed-smoke.spec.ts` aos mesmos projetos e job da CI, descoberto automaticamente por Playwright. Seus quatro percursos (clássico/velocidade em desktop/móvel) levaram **4,6 minutos** na execução local registrada naquela tarefa. A velocidade exercita seis perguntas, base/bônus/total nas duas telas, recarga após resposta, prazo preservado, encerramento e retorno ao lobby.

A [T19](aposta.md) acrescenta `wager-smoke.spec.ts`, totalizando seis percursos nas mesmas duas resoluções. O roteiro verifica saldo zero, escolhas 0/25/50, ausência de aposta e de resposta, recarga após apostar, privacidade do enunciado/valores, ganhos/perdas e retorno ao lobby, com resultado **425/325**. O artefato da CI passa a se chamar `smoke-modalidades`; todos os percursos continuam no job `smoke`.

Os seis percursos passaram localmente em **8,3 minutos** em 19/10/2026, sem retry. Naquela etapa, o job recebeu limite de 15 minutos para as três modalidades com os tempos reais. A aposta anexa também capturas de conclusão/placar e resumo; as evidências detalhadas estão na [T19](tasks/T19-fase-aposta.md).

O [protótipo da T20](roubo.md) acrescenta `theft-smoke.spec.ts` aos mesmos projetos e ao artefato `smoke-modalidades`, totalizando oito percursos. O novo teste cobre seis perguntas, erro mais rápido, dois acertos, nenhum acerto, timeout sem alvo, troca de autor, recarga durante a escolha, transferência/placar nas duas telas e retorno ao lobby. O resultado esperado é **400/400** e há capturas da transferência. O job passou a dispor de 20 minutos para as quatro modalidades e instalação do navegador. D05 permanece em consulta; a cobertura de protótipo não consolida a variante.

Os **oito percursos passaram em 10,6 minutos**, sem retry, na execução Windows de 19/10/2026. O roubo terminou em **400/400** e **4/4 acertos** nas duas resoluções, com capturas de transferência inspecionadas. A CI hospedada ainda não foi executada; não houve push/deploy. Evidências estão na [T20](tasks/T20-fase-roubo.md).

O [protótipo da T21](dinamite.md) acrescenta `pressure-smoke.spec.ts` aos dois projetos, totalizando dez percursos das cinco modalidades. O cenário de dinamite usa dois jogadores, quatro turnos, ordem inversa no segundo ciclo, perguntas médias/difíceis, controles exclusivos, recarga com prazo preservado, acertos, timeout e erro, encerrando em **150/150** com um acerto por pessoa. As capturas mostram explosão e próximo turno. O job mantém 20 minutos e o mesmo artefato `smoke-modalidades`. D04 continua em consulta; evidências executadas ficam na [T21](tasks/T21-quinta-fase-pressao.md).

Os **dez percursos passaram em 12,7 minutos**, sem retry, na execução Windows de 19/10/2026. A dinamite terminou em **150/150** e **1/1 acertos** nas duas resoluções; suas capturas foram inspecionadas. A CI hospedada ainda não foi executada.

A [T22](classificacao-e-vidas.md) estende o smoke clássico para conferir `finalEntry` nos eventos recebidos ao encerrar: pontos **500/200**, acertos **5/2**, vidas **5/4**, perdas suportadas **4/3** e perda eliminatória **5/4**. O cenário focado passou em desktop e celular emulado, **2 percursos em 2,7 minutos**, sem retry. Esse resumo tem escopo de protótipo; as telas e a partida real da final ainda serão integradas. A matriz inteira das cinco modalidades não foi repetida nesta tarefa.

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

O [roteiro de inspeção](teste-manual-m2.md) registra ações, resultados esperados e execução desktop/móvel. A base da configuração segue a documentação oficial de [fixtures](https://playwright.dev/docs/test-fixtures), [TypeScript](https://playwright.dev/docs/test-typescript) e [CI](https://playwright.dev/docs/ci-intro). A partida completa, navegadores adicionais e grupos maiores pertencem aos marcos seguintes.

## Final na web — T24

`final-smoke.spec.ts` continua o clássico concluído pela interface, com classificação sem empate e estoque real do catálogo. Cobre primeira resposta exclusiva entre duas sessões, erro, acerto, ataque manual a alvo desconectado, dano único, recarga com prazo preservado e eliminação/reconexão até o aviso de sobrevivente e retorno ao lobby. Roda com os relógios reais do aplicativo e do navegador; sincroniza os cliques concorrentes pela fila sem modificar estado. Em 20/10/2026, os projetos desktop e celular emulado passaram em 3,7 minutos, com teclado/toque, auditoria pública e capturas inspecionadas. Consulte [final na web](final-na-web.md) e [T24](tasks/T24-final-na-web.md). Os testes das modalidades isoladas também integram a descoberta automática do job `smoke`; isso ainda não representa a sequência completa das cinco fases.

## Pódio e revanche — T25

O mesmo smoke foi ampliado para duas partidas consecutivas por projeto, sempre com clássico + final. Depois do primeiro pódio, entra um espectador e sai o anfitrião; quem foi eliminado assume o grupo e prepara a revanche pelo serviço. O espectador ocupa a vaga no lobby, e a nova partida começa com IDs novos e pontuação zero, conservando sala/perfis e a fila de temas. Na segunda final, o segundo colocado vence o líder em pontos; a ordem do pódio, o resumo por fase e o placar histórico continuam coerentes após recarga.

Em 20/10/2026, **desktop e celular emulado passaram: dois testes em 7,3 minutos**, com captura `podio-revanche.png` inspecionada em ambos, toque/teclado, auditoria de privacidade e ausência de rolagem horizontal. O job existente descobre os testes automaticamente e tem 30 minutos para executar modalidades, finais e revanches. Consulte [pódio e revanche](podio-e-revanche.md) e [T25](tasks/T25-podio-e-revanche.md). O resultado continua limitado aos protótipos isolados; não representa uma sequência das cinco modalidades.

## Reconexão e ciclo de vida — T26

`reconnection-smoke.spec.ts` usa os relógios reais do servidor/navegadores. Registra resposta, recarrega sem restaurar tentativa/prazo, deixa todas as conexões saírem e espera uma resolução sem próxima pergunta. Recupera a sala antes de 120 s, confere a transferência de anfitrião após 30 s e substitui uma aba autenticada sem duplicar participante nem liberar outra resposta. Retorno do anfitrião antigo não toma o controle de volta. As capturas `reconexao.png` foram inspecionadas em desktop/celular emulado.

Em 20/10/2026, o comando com `reconnection-smoke.spec.ts final-smoke.spec.ts` passou nos dois projetos: **quatro testes em 8,9 minutos**, incluindo as duas partidas consecutivas por projeto e recuperação do alvo/pódio. `restart-smoke.spec.ts` passou adicionalmente nos dois projetos em **9,6 segundos**: aplicativo novo no mesmo backend, sessão/sala antigas encerradas e perfil local preservado. Relatório principal em `e2e/playwright-report/`, relatório de reinício em `e2e/playwright-report/restart/`; resultados em `e2e/test-results/`, com reinício no subdiretório `restart/`. Consulte a [matriz de reconexão](cenarios-de-reconexao.md) e [T26](tasks/T26-reconexao-e-ciclo-de-vida.md).

## Catálogo ampliado — T27

Em 20/10/2026, `classic-smoke.spec.ts` foi repetido com o catálogo publicado de **300 perguntas**, em desktop e celular emulado: **dois testes passaram em 2,6 minutos**. O percurso confere duas identidades, convite, recarga, seis perguntas reais sem repetição, mistura 3 fáceis/3 médias, placares de 500/200, classificação e retorno ao lobby, com auditoria das mensagens públicas. Relatório em `e2e/playwright-report/t27/` e resultados/capturas em `e2e/test-results/t27/`. O orçamento das cinco fases e a reserva de 50 são verificados separadamente pelas 66 simulações determinísticas da [T27](tasks/T27-catalogo-de-teste-completo.md); este smoke continua sendo uma fase clássica isolada.

## Matriz integrada — T29

A [matriz da partida completa](e2e-partida-completa.md) amplia o modo padrão com duas ordens, as cinco modalidades ao longo das partidas, reconexão, troca de anfitrião/aba, sala vazia e inspeção de 12 participantes. `pnpm test:e2e:classic` executa essa matriz com tempos exclusivos de teste; o job `full-match` a separa dos 16 percursos históricos do job `smoke`. A descoberta geral inclui ambos. As regras D02–D06 continuam em consulta.
