# PENSHOW

Jogo multiplayer de perguntas e respostas para jogar com amigos pelo navegador. Crie uma sala, escolha seu nome e monte seu personagem para disputar fases com regras diferentes.

O desempenho nas primeiras cinco fases determinará a vantagem na final: **1º lugar com 5 vidas, 2º com 4, 3º com 3 e os demais com 2**. Assim, sobrevivem respectivamente a 4, 3, 2 e 1 perdas de vida; a perda seguinte elimina. Na final, só a primeira resposta de cada pergunta é avaliada: se errar, o jogador perde uma vida; se acertar, escolhe qualquer adversário ainda na disputa para tirar uma vida. A pergunta se encerra após essa jogada.

## Estado do projeto

A base do monorepo está disponível: navegação React, editor de personagens com 50 peças, perfil local, stores, componentes acessíveis, servidor Fastify e contratos compartilhados. Já é possível criar uma sala, entrar por código/convite e reunir o grupo no lobby com perfis, presença e preferências compartilhadas. Sessões autenticadas e reconexão preservam a identidade e a vaga. O catálogo privado contém um [lote inicial de 72 perguntas revisadas](docs/revisao-editorial-t11.md), com 12 por tema. O [quiz clássico de teste](docs/quiz-classico-web.md) pode ser iniciado na web em desenvolvimento/teste: seis perguntas, resposta definitiva, revelação, placar e retorno ao lobby. O [smoke em Playwright](docs/smoke-m2.md) cobre o percurso real com duas identidades em desktop e celular emulado. Ainda não há partida completa ou versão publicada.

O projeto parte da arquitetura do [Comicle](https://github.com/ninguemdev/Comicle), especialmente suas salas, identidade de convidado, nomes e avatares. As fases têm como referência a dinâmica de programas de perguntas do [Brain Show](https://store.steampowered.com/app/2235150/).

## Planejamento

- [Plano detalhado do jogo](docs/plano-do-jogo.md): cada fase, quantidade de perguntas, pontos, tempos, exemplos, final e casos de borda.
- [Plano de desenvolvimento](docs/planejamento.md): entregas, prioridades e critérios de conclusão.
- [Tasks de implementação](docs/tasks/README.md): 35 tarefas com dependências, módulos, entregáveis, aceite e verificações, no formato do Comicle.
- [Análise do Comicle](docs/analise-comicle.md): módulos examinados e adaptações necessárias.
- [Referência do Brain Show](docs/referencia-brain-show.md): evidências e propostas para o PENSHOW.
- [Regras em discussão](docs/regras.md): o que foi definido e o que precisa ser decidido.
- [Arquitetura](docs/arquitetura.md): organização, responsabilidades e contratos previstos.
- [Protocolo realtime](docs/protocolo-realtime.md): comandos, confirmações, erros e versões dos contratos públicos; sincronização de tempo disponível.
- [Modelo de dados](docs/modelo-de-dados.md): perfis, fases, placar, vidas e separação entre perguntas públicas e dados privados.
- [Servidor](docs/servidor.md): configuração, portas injetáveis, transporte, erros, logs e encerramento.
- [Sessões](docs/sessoes.md): criação, verificação, renovação, expiração e conexão ativa por identidade.
- [Salas](docs/salas.md): fila, membros, anfitrião, comandos autenticados, projeções e ciclo de vida.
- [Motor de partida](docs/motor-de-partida.md): máquina pura, estratégias, transações, prazos e projeções internas.
- [Quiz clássico](docs/quiz-classico.md): comandos autenticados, seis perguntas, progresso, privacidade e restrição do protótipo a desenvolvimento/teste.
- [Quiz na web](docs/quiz-classico-web.md): telas por estado, respostas, cronômetro, placar, reconexão e teclado/toque.
- [Smoke M2](docs/smoke-m2.md): Playwright, duas identidades, isolamento, CI e [roteiro de inspeção](docs/teste-manual-m2.md).
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

`pnpm test` executa os testes de conteúdo, artes e as suítes Vitest de shared, server e web. `pnpm avatars:check` confere as 50 artes e o catálogo público. `pnpm format` aplica a formatação. Os arquivos editoriais em `data/` e os documentos de planejamento em `docs/` preservam seu formato original.

O build gera `packages/shared/dist`, `apps/server/dist` e `apps/web/dist`. Após compilar, `pnpm start` inicia o servidor e `pnpm --filter @penshow/web preview` serve a web para inspeção do artefato. Os proxies HTTP/socket do Vite funcionam no preview; na hospedagem estática, encaminhe `/api` ao servidor removendo esse prefixo e `/penshow/socket.io` preservando o caminho e o upgrade WebSocket. `VITE_BASE_PATH` permite servir a web em `/penshow/`; consulte [interface](docs/interface.md). A operação de produção será tratada em T34.

`PORT` e `HOST` configuram a escuta do servidor (padrões: `3000` e `127.0.0.1`). Se mudar a porta, ajuste também o destino do proxy em `apps/web/vite.config.ts`. Socket.IO usa `/penshow/socket.io`, com origens permitidas e limites de mensagem configuráveis. As variáveis estão em `.env.example`; o arquivo `.env` não é carregado automaticamente. Consulte [servidor](docs/servidor.md) para uso do ambiente e [desenvolvimento](docs/desenvolvimento.md) para ferramentas e verificações.

## Ferramentas de conteúdo

```sh
pnpm questions:validate
pnpm questions:publish
pnpm questions:check
pnpm test:content
```

Os comandos anteriores `npm test` e `npm run questions:validate` continuam disponíveis; o primeiro agora também executa as suítes dos pacotes e requer a instalação do workspace com pnpm.

Os arquivos em `data/questions/candidates` são candidatos à revisão editorial. Não devem ser usados automaticamente numa partida. As fontes e suas licenças estão em `data/sources.json` e `data/licenses`.

Copie os registros escolhidos para `data/questions/reviewed`, registre a revisão factual/idioma/resposta única e só então marque sua aprovação. `questions:publish` gera atomicamente `data/questions/published/catalog.json` e o relatório editorial; `questions:check` verifica a correspondência sem escrever. O servidor carrega somente esse catálogo privado, validando-o antes de aceitar requisições. A T11 publica 72 perguntas: seis fáceis, quatro médias e duas difíceis em cada um dos seis temas. É um lote inicial para fases isoladas; a cobertura de uma partida completa com doze jogadores pertence a marcos posteriores. Consulte [perguntas](docs/perguntas.md) para o formato, as garantias e seus limites.

Coleta inicial: **1.531 candidatos**, sendo **531 em português para revisão** e **1.000 em inglês para tradução**. Nenhum foi marcado como aprovado. O objetivo de expansão é chegar a 5.000 perguntas revisadas em pt-BR.

```sh
pnpm questions:import
pnpm questions:import:opentdb --amount=1000
```

O segundo comando faz uma coleta opcional em inglês, respeitando o intervalo da fonte; o material precisa de tradução e revisão antes de entrar no jogo. A importação é uma ferramenta de preparação: partidas não dependerão de serviços externos de perguntas.
