# PENSHOW

Jogo multiplayer de perguntas e respostas para jogar com amigos pelo navegador. Crie uma sala, escolha seu nome e monte seu personagem para disputar fases com regras diferentes.

O desempenho nas quatro primeiras fases do modo clássico determinará a vantagem na final, sempre a quinta fase: **1º lugar com 5 vidas, 2º com 4, 3º com 3 e os demais com 2**. Assim, sobrevivem respectivamente a 4, 3, 2 e 1 perdas de vida; a perda seguinte elimina. Na final, só a primeira resposta de cada pergunta é avaliada: se errar, o jogador perde uma vida; se acertar, escolhe qualquer adversário ainda na disputa para tirar uma vida. A pergunta se encerra após essa jogada.

## Estado do projeto

A base do monorepo está disponível: navegação React, editor de personagens com 50 peças, perfil local, stores, componentes acessíveis, servidor Fastify e contratos compartilhados. Já é possível criar uma sala, entrar por código/convite e reunir o grupo no lobby com perfis, presença e preferências compartilhadas. Sessões autenticadas e reconexão preservam a identidade e a vaga. O catálogo privado contém [300 perguntas revisadas](docs/revisao-editorial-t27.md), com 50 por tema e estoque validado para o orçamento completo de conteúdo. O [quiz clássico de teste](docs/quiz-classico-web.md) pode ser iniciado na web em desenvolvimento/teste: seis perguntas, resposta definitiva, revelação, placar e retorno ao lobby. O [smoke em Playwright](docs/smoke-m2.md) cobre o percurso real com duas identidades em desktop e celular emulado. O [modo clássico integrado](docs/modo-classico.md) já percorre cinco fases em desenvolvimento/teste, com as pausas explícitas das regras ainda em consulta; ainda não há versão publicada.

O projeto parte da arquitetura do [Comicle](https://github.com/ninguemdev/Comicle), especialmente suas salas, identidade de convidado, nomes e avatares. As fases têm como referência a dinâmica de programas de perguntas do [Brain Show](https://store.steampowered.com/app/2235150/).

A [modalidade de velocidade](docs/velocidade.md) também está disponível como fase isolada de teste no lobby: seis perguntas, bônus por faixa de tempo recebido no servidor e detalhamento de base, bônus e total. Os testes de navegador cobrem clássico e velocidade em desktop e celular emulado. Pontos e tempos continuam experimentais; a sequência completa das fases permanece para as próximas tarefas.

A [modalidade de aposta](docs/aposta.md) acrescenta uma escolha privada antes de cada enunciado, limitada ao saldo, com confirmação e liquidação única na revelação. Também está disponível como fase isolada no lobby em desenvolvimento/teste; não há saldo inicial artificial ou desconto antecipado.

O [protótipo de roubo](docs/roubo.md) permite escolher adversário depois de fechar as respostas e transfere pontos limitados ao saldo após os acertos. Ele exercita a proposta de direito exclusivo do primeiro acerto; D05 continua pendente antes da consolidação da modalidade.

O [protótipo de dinamite](docs/dinamite.md) acrescenta dois turnos por participante, ordem sorteada e inversa no segundo ciclo, prazo individual completo e explosão com penalidade limitada ao saldo. D04 continua pendente para a escolha definitiva da quinta modalidade.

A [classificação e atribuição de vidas](docs/classificacao-e-vidas.md) guarda um retrato único do placar ao encerrar os protótipos, com 5/4/3/2 vidas quando a ordem está definida. Empates mantêm D06 pendente e não atribuem vidas automaticamente.

O [protótipo da final no servidor](docs/final-no-servidor.md) aceita a primeira resposta válida, aplica uma perda por erro ou ataque manual e encerra pelo único sobrevivente. Ele pode continuar um plano isolado concluído com classificação pronta e estoque suficiente. A [interface da final](docs/final-na-web.md) mostra conversão para vidas, disputa, alvo, perdas e eliminação, com recuperação da etapa após reconectar. D02/D03 permanecem pendentes e aparecem como pausas explícitas no teste.

## Planejamento

A [T36 — Modo clássico padrão](docs/tasks/T36-modo-classico-padrao.md) integra experimentalmente a partida de cinco fases: quatro modalidades distintas sorteadas e a final na quinta posição. Com as cinco modalidades de pontuação atuais, uma fica de fora em cada partida. Esse formato é a opção padrão das novas salas em desenvolvimento/teste; a consolidação depende das regras em consulta.

O [pódio, histórico e revanche](docs/podio-e-revanche.md) mostram a ordem da final e os resultados das fases disputadas, com o placar anterior identificado como histórico. O anfitrião pode preparar outra partida na mesma sala; perfis e fila de temas são preservados, espectadores ocupam vagas disponíveis e quem saiu libera sua vaga.

- [Plano detalhado do jogo](docs/plano-do-jogo.md): cada fase, quantidade de perguntas, pontos, tempos, exemplos, final e casos de borda.
- [Plano de desenvolvimento](docs/planejamento.md): entregas, prioridades e critérios de conclusão.
- [Tasks de implementação](docs/tasks/README.md): 38 tarefas com dependências, módulos, entregáveis, aceite e verificações, no formato do Comicle.
- [Análise do Comicle](docs/analise-comicle.md): módulos examinados e adaptações necessárias.
- [Referência do Brain Show](docs/referencia-brain-show.md): evidências e propostas para o PENSHOW.
- [Regras em discussão](docs/regras.md): o que foi definido e o que precisa ser decidido.
- [Arquitetura](docs/arquitetura.md): organização, responsabilidades e contratos previstos.
- [Protocolo realtime](docs/protocolo-realtime.md): comandos, confirmações, erros e versões dos contratos públicos; sincronização de tempo disponível.
- [Modelo de dados](docs/modelo-de-dados.md): perfis, fases, placar, vidas e separação entre perguntas públicas e dados privados.
- [Servidor](docs/servidor.md): configuração, portas injetáveis, transporte, erros, logs e encerramento.
- [Narrador robótico](docs/narrador-robotico.md): voz clássica em pt-BR para ler o enunciado antes das respostas, com prévia e volume próprios.
- [Build e operação](docs/deploy.md): imagem Docker, execução local em `/penshow/`, variáveis, proxy HTTPS/WebSocket, logs, reinício e rollback.
- [Sessões](docs/sessoes.md): criação, verificação, renovação, expiração e conexão ativa por identidade.
- [Salas](docs/salas.md): fila, membros, anfitrião, comandos autenticados, projeções e ciclo de vida.
- [Motor de partida](docs/motor-de-partida.md): máquina pura, estratégias, transações, prazos e projeções internas.
- [Quiz clássico](docs/quiz-classico.md): comandos autenticados, seis perguntas, progresso, privacidade e restrição do protótipo a desenvolvimento/teste.
- [Quiz na web](docs/quiz-classico-web.md): telas por estado, respostas, cronômetro, placar, reconexão e teclado/toque.
- [Velocidade](docs/velocidade.md): seis perguntas de teste, faixas de bônus oficiais no servidor e detalhamento na interface; disponível pelo lobby em desenvolvimento/teste.
- [Aposta](docs/aposta.md): escolha privada antes do enunciado, valores cobertos pelo saldo, confirmação e liquidação única; teste isolado pelo lobby em desenvolvimento/teste.
- [Roubo](docs/roubo.md): protótipo do primeiro acerto, alvo autorizado, transferência conservada e decomposição do saldo; D05 em consulta.
- [Dinamite](docs/dinamite.md): turno exclusivo, dois ciclos inversos, pavio individual e explosão sem eliminação; D04 em consulta.
- [Classificação e vidas](docs/classificacao-e-vidas.md): placar histórico congelado, distribuição confirmada e registro explícito de empates; D06 em consulta.
- [Final no servidor](docs/final-no-servidor.md): primeira resposta exclusiva, ataque manual, eliminações e projeções; D02/D03 em consulta.
- [Final na web](docs/final-na-web.md): conversão para vidas, prioridade confirmada, alvo, resolução acessível, espectador e reconexão.
- [Pódio e revanche](docs/podio-e-revanche.md): ordem pelo sobrevivente, resumo por fase, novo elenco e continuidade da fila de temas na mesma sala.
- [Reconexão e ciclo de vida](docs/cenarios-de-reconexao.md): matriz por etapa, janela preservada, sala vazia, transferência de anfitrião, consulta de associação e limites após reinício.
- [Privacidade, limites e concorrência](docs/privacidade-limites-e-concorrencia.md): orçamentos por identidade/IP, capacidade, matriz de exposição e isolamento de três salas com 12 jogadores.
- [Smoke M2](docs/smoke-m2.md): Playwright, duas identidades, isolamento, CI e [roteiro de inspeção](docs/teste-manual-m2.md).
- [Testes da partida completa](docs/e2e-partida-completa.md): matriz integrada, falhas, 12 participantes e execução separada na CI.
- [Piloto de grupos e equilíbrio](docs/testes-de-grupo-e-equilibrio.md): simulação local com 2, 4, 8 e 12 jogadores, comparação de parâmetros e roteiro de observação humana.
- [Interface](docs/interface.md): navegação, componentes, estilo provisório, caminho base e estados de conexão/armazenamento.
- [Avatares](docs/avatares.md): catálogo, editor, persistência, verificação de artes e [licenças](THIRD_PARTY_NOTICES.md).
- [Banco de perguntas](docs/perguntas.md): fontes, categorias, revisão e expansão.
- [Decisões](docs/decisoes.md): regras confirmadas, propostas em consulta e escolhas de etapas posteriores.

## Desenvolvimento

Requer Node.js **24.15 ou superior da linha 24** e **pnpm 12.9.1** (fixado em `packageManager`). Com Corepack instalado, execute `corepack enable` para disponibilizar a versão indicada pelo projeto.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

A web abre em `http://127.0.0.1:5173` e consulta o servidor em `http://127.0.0.1:3000/health` pelo proxy `/api`. A resposta esperada é `{"service":"penshow","status":"ok"}`. `pnpm dev` compila shared antes de iniciar os três pacotes em modo de observação. Encerre com Ctrl+C.

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm questions:validate
pnpm avatars:check
pnpm build
```

`pnpm test:e2e:a11y` verifica teclado, árvore de acessibilidade, contraste, textos extensos e adaptação de telas no navegador real após o build. Consulte [acessibilidade e limites da revisão](docs/acessibilidade.md).

`pnpm test:e2e:sound` verifica os 16 efeitos sintetizados, cliques reais, preferências, áudio indisponível, reconexão e renderização do motor real. Após `pnpm build`, `pnpm sounds:preview` gera a prévia WAV e os efeitos separados em `data/audio-previews/`. Consulte [sons e validação](docs/sons.md).

`pnpm pilot:simulate` gera o relatório mecânico de equilíbrio usando os serviços reais, snapshot privado de 300 perguntas usado na T32, jogadores roteirizados e relógio virtual. `pnpm pilot:simulate --check` reproduz o relatório sem escrever. Os tempos simulados e as comparações de pontos não substituem sessões humanas; consulte [método, resultados e roteiro](docs/testes-de-grupo-e-equilibrio.md).

`pnpm questions:audit` verifica os lotes editoriais e a publicação atual, com 336 perguntas após o primeiro lote da T33. `pnpm questions:capacity` simula partidas consecutivas sem repetir conteúdo, com orçamento explícito de 50 perguntas na final simulada. Ambos aceitam `--check`; consulte o [relatório da expansão](docs/expansao-editorial-t33.md). A meta de 5.000 permanece pendente.

`pnpm test` executa os testes de conteúdo, artes e as suítes Vitest de shared, server e web. `pnpm avatars:check` confere as 50 artes e o catálogo público. `pnpm format` aplica a formatação. Os arquivos editoriais em `data/` e os documentos de planejamento em `docs/` preservam seu formato original.

O build gera `packages/shared/dist`, `apps/server/dist` e `apps/web/dist`. Após compilar, `pnpm start` inicia o servidor e `pnpm --filter @penshow/web preview` serve a web para inspeção do artefato. Os proxies HTTP/socket do Vite funcionam no preview. O servidor também atende `/api` diretamente e pode servir a interface compilada quando `WEB_ROOT` está configurado. `VITE_BASE_PATH` e `WEB_BASE_PATH` precisam coincidir; consulte [interface](docs/interface.md) e [deploy](docs/deploy.md).

`docker compose --env-file infra/production.env.example up --build --detach --wait` constrói a imagem e abre a interface em `http://127.0.0.1:8080/penshow/`, com API e socket no mesmo processo. Em produção, somente perfis/salas/lobby estão habilitados; as regras experimentais das partidas continuam restritas a desenvolvimento/teste. `pnpm test:container penshow:local` verifica a imagem, privacidade, parada/reinício e uma partida curta na mesma imagem em teste local. A hospedagem externa continua na T35/D08.

`PORT` e `HOST` configuram a escuta do servidor (padrões: `3000` e `127.0.0.1`). Se mudar a porta, ajuste também o destino do proxy em `apps/web/vite.config.ts`. Socket.IO usa `/penshow/socket.io`, com origens permitidas e limites de mensagem configuráveis. As variáveis estão em `.env.example`; o arquivo `.env` não é carregado automaticamente. Consulte [servidor](docs/servidor.md) para uso do ambiente e [desenvolvimento](docs/desenvolvimento.md) para ferramentas e verificações.

## Ferramentas de conteúdo

```sh
pnpm questions:validate
pnpm questions:publish
pnpm questions:check
pnpm questions:simulate --check
pnpm test:content
```

Os comandos anteriores `npm test` e `npm run questions:validate` continuam disponíveis; o primeiro agora também executa as suítes dos pacotes e requer a instalação do workspace com pnpm.

Os arquivos em `data/questions/candidates` são candidatos à revisão editorial. Não devem ser usados automaticamente numa partida. As fontes e suas licenças estão em `data/sources.json` e `data/licenses`.

Copie os registros escolhidos para `data/questions/reviewed`, registre a revisão factual/idioma/resposta única e só então marque sua aprovação. `questions:publish` gera atomicamente `data/questions/published/catalog.json` e o relatório editorial; `questions:check` verifica a correspondência sem escrever. O servidor carrega somente esse catálogo privado, validando-o antes de aceitar requisições. A T27 amplia as 72 da T11 para **300 perguntas: 15 fáceis, 20 médias e 15 difíceis em cada um dos seis temas**. `questions:simulate` gera o relatório de reserva/seleção; `questions:simulate --check` o reproduz sem escrever. O orçamento experimental das cinco fases mais 50 perguntas para a final funciona com 2–12 jogadores e pelo menos três temas habilitados. A integração da sequência de fases e as regras pendentes continuam nas tarefas próprias. Consulte [perguntas](docs/perguntas.md) para o formato, as garantias e seus limites.

Coleta inicial: **1.531 candidatos**, sendo **531 em português para revisão** e **1.000 em inglês para tradução**. Nenhum foi marcado como aprovado. O objetivo de expansão é chegar a 5.000 perguntas revisadas em pt-BR.

```sh
pnpm questions:import
pnpm questions:import:opentdb --amount=1000
```

O segundo comando faz uma coleta opcional em inglês, respeitando o intervalo da fonte; o material precisa de tradução e revisão antes de entrar no jogo. A importação é uma ferramenta de preparação: partidas não dependerão de serviços externos de perguntas.
