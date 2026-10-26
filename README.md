# PENSHOW

Jogo multiplayer de perguntas e respostas em português, para **2 a 12 jogadores** pelo navegador. Crie uma sala, compartilhe o convite, personalize seu personagem e dispute uma partida com modalidades diferentes e uma final por vidas.

**[Jogar PENSHOW](https://dionel.site/penshow/)** · [Regras](docs/plano-do-jogo.md) · [Documentação](docs/arquitetura.md) · [Licença MIT](LICENSE)

## O que já funciona

- Salas por código ou convite, lobby, preferências compartilhadas, presença e reconexão.
- Perfil local e editor com 51 peças de avatar, incluindo cabelo: arraste e ajuste posição/tamanho das peças, mantendo a cabeça fixa.
- Modo clássico com cinco fases: quatro modalidades distintas sorteadas e uma final.
- Quiz, velocidade, aposta, roubo e dinamite, também disponíveis como fases isoladas em desenvolvimento/teste.
- Final por vidas, desempate de tiro 2D, pódio, histórico das fases e revanche na mesma sala.
- Narrador robótico em pt-BR, efeitos sonoros e controles independentes de volume.
- Interface para computador e celular, com testes de teclado, toque e acessibilidade.
- Catálogo de **348 perguntas aprovadas**, distribuídas em seis temas, com narrações preparadas no build.

O projeto está em fase de **piloto**. A implantação de 26/10/2026 e suas verificações estão no [relatório de publicação](docs/validation/t35-piloto-compartilhado.md). A expansão para 5.000 perguntas, os testes com grupos humanos e a revisão em dispositivos físicos continuam no [planejamento](docs/planejamento.md).

## Como jogar

1. Escolha seu nome e monte seu personagem.
2. Crie uma sala ou entre pelo código/link de convite.
3. Reúna pelo menos dois jogadores; o anfitrião ajusta as preferências e inicia a partida.
4. Acumule pontos nas quatro primeiras fases para entrar na final com mais vidas.

| Modalidade | Dinâmica                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| Quiz       | Responda às perguntas para acumular pontos.                                                              |
| Velocidade | Acertos recebem bônus conforme o tempo de resposta registrado no servidor.                               |
| Aposta     | Escolha uma aposta privada, limitada ao seu saldo, antes de ver o enunciado.                             |
| Roubo      | Todos os acertos rendem 100 pontos; somente o primeiro acerto pode roubar até 100 de um adversário.      |
| Dinamite   | Cada participante joga dois turnos, com ordem invertida no segundo ciclo e penalidade limitada ao saldo. |

Na final, a classificação por pontos e acertos concede **5, 4, 3 e 2 vidas** por grupo de colocação; empatados recebem a mesma quantidade, sem saltar posições entre grupos. Só a primeira resposta válida de cada pergunta é avaliada: erro custa uma vida; acerto permite tirar uma vida de um adversário. Se ninguém responder, todos os ativos perdem uma vida. Se quem acertou não escolher um alvo a tempo, o sorteio inclui todos os ativos, inclusive o próprio jogador.

Eliminações simultâneas levam o grupo empatado ao **desempate de tiro 2D**. Cada participante começa com três vidas de combate; ao chegar a zero, responde a uma pergunta de sobrevivência. Acertar devolve uma vida; errar ou deixar o prazo vencer elimina. Consulte as [regras do modo clássico](docs/modo-classico.md) e o [guia do desempate](docs/desempate-tiro.md).

## Tecnologias e estrutura

Monorepo TypeScript com pnpm, React, Vite, Zustand, Fastify, Socket.IO e Zod. Os testes usam Vitest, Playwright e o executor nativo do Node.js.

```text
apps/web/         Interface, perfis, lobby, partida, áudio e avatares
apps/server/      API HTTP, sessões, salas e regras autoritativas da partida
packages/shared/  Contratos, schemas, regras e catálogo público de avatares
e2e/              Testes de navegador
data/             Perguntas, fontes, licenças e narrações geradas
scripts/          Ferramentas editoriais, validações e simulações
infra/            Configuração de produção, EC2 e Cloudflare
docs/             Regras, arquitetura, planejamento e evidências de validação
```

O servidor mantém salas e partidas em memória; reiniciá-lo encerra esse estado. O catálogo de perguntas e as narrações ficam no servidor, fora da raiz estática da web. Durante o jogo, o cliente recebe apenas os dados permitidos para sua sala e etapa.

## Executar localmente

Requisitos: **Node.js 24.15 ou superior da linha 24** e **pnpm 12.9.1**, conforme `engines` e `packageManager` no [package.json](package.json). Com Corepack instalado, `corepack enable` disponibiliza o gerenciador indicado pelo projeto.

```sh
git clone https://github.com/ninguemdev/PENSHOW.git
cd PENSHOW
pnpm install --frozen-lockfile
pnpm dev
```

Acesse **http://127.0.0.1:5173**. O servidor escuta em `http://127.0.0.1:3000`; a web encaminha `/api` e o socket pelo proxy do Vite. O endpoint `/api/health` da web deve retornar `{"service":"penshow","status":"ok"}`.

`pnpm dev` prepara as narrações, compila o pacote compartilhado e inicia os processos em modo de observação. A primeira geração de áudio pode demorar mais; os arquivos ficam em `data/narration/generated/` e são reaproveitados nas próximas execuções. Encerre com Ctrl+C.

Os valores padrão permitem iniciar sem configurar variáveis. Consulte [.env.example](.env.example) para as opções do servidor e [apps/web/.env.example](apps/web/.env.example) para o caminho base da interface. **O servidor não carrega `.env` automaticamente**: forneça as variáveis no ambiente do processo. Se alterar `PORT`, ajuste também os destinos do proxy em [vite.config.ts](apps/web/vite.config.ts).

Mais detalhes no [guia de desenvolvimento](docs/desenvolvimento.md) e no [guia do servidor](docs/servidor.md).

## Verificações

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm questions:validate
pnpm questions:check
pnpm avatars:check
pnpm build
```

`pnpm test` prepara as narrações e executa testes de conteúdo, artes e suítes Vitest. `pnpm build` gera os artefatos de shared, server e web, além dos áudios necessários ao servidor.

Para os testes de navegador, instale o Chromium do Playwright:

```sh
pnpm --filter @penshow/e2e exec playwright install chromium
pnpm test:e2e
```

Depois do build, também é possível executar conjuntos específicos:

| Comando                  | Cobertura                                                |
| ------------------------ | -------------------------------------------------------- |
| `pnpm test:e2e:classic`  | Partida completa, falhas e capacidade                    |
| `pnpm test:e2e:a11y`     | Teclado, acessibilidade, contraste e adaptação das telas |
| `pnpm test:e2e:sound`    | Efeitos sonoros, preferências e narrador                 |
| `pnpm test:e2e:narrator` | Narração, sincronização e recuperação de áudio           |
| `pnpm test:e2e:tiebreak` | Combate, perguntas de sobrevivência e pódio              |

O [workflow de CI](.github/workflows/ci.yml) reúne verificações de qualidade, conteúdo, imagem Docker e testes de navegador. Simulações de equilíbrio e carga estão documentadas em [testes de grupo](docs/testes-de-grupo-e-equilibrio.md) e [desempate](docs/desempate-tiro.md).

## Build e Docker

```sh
pnpm build
pnpm start
```

`pnpm start` inicia o servidor compilado. Para inspecionar a interface, execute `pnpm --filter @penshow/web preview` em outro terminal. Para servi-la pelo próprio servidor, configure `WEB_ROOT` com o caminho absoluto de `apps/web/dist`; `WEB_BASE_PATH` deve coincidir com o `VITE_BASE_PATH` usado no build.

Com Docker e Compose:

```sh
docker compose --env-file infra/production.env.example up --build --detach --wait
```

A interface fica em **http://127.0.0.1:8080/penshow/**. O exemplo inicia com partidas desabilitadas em produção: para jogar, defina `GAMEPLAY_ENABLED=true` no arquivo de ambiente usado pelo Compose e execute o comando novamente. Configure `ALLOWED_ORIGINS` para a origem de acesso ao publicar em outro endereço.

Consulte [build e operação](docs/deploy.md), [implantação em EC2](infra/ec2/README.md) e [rotas Cloudflare](infra/cloudflare/README.md) para HTTPS, WebSocket, logs e rollback.

## Banco de perguntas

O catálogo publicado contém **348 perguntas revisadas, com 58 por tema**. Candidatos importados ficam separados e só entram no jogo após revisão factual, de idioma e de resposta única. A meta editorial é chegar a 5.000 perguntas aprovadas em pt-BR; partidas usam o catálogo local e não dependem de serviços externos de perguntas.

```sh
pnpm questions:validate
pnpm questions:publish
pnpm questions:check
pnpm questions:audit --check
pnpm questions:capacity --check
```

`questions:publish` gera o catálogo privado em `data/questions/published/catalog.json`; `questions:check` confere a publicação sem escrever. Após alterar o catálogo, execute `pnpm narrations:build` antes de iniciar o servidor, ou use `pnpm dev`/`pnpm build`, que já fazem essa preparação.

Os importadores `pnpm questions:import` e `pnpm questions:import:opentdb --amount=1000` coletam candidatos para revisão, sem aprová-los automaticamente. Formato, fontes e processo editorial estão no [guia de perguntas](docs/perguntas.md) e no [relatório de expansão](docs/expansao-editorial-t33.md).

## Documentação

- **Produto:** [plano do jogo](docs/plano-do-jogo.md), [decisões](docs/decisoes.md), [planejamento](docs/planejamento.md) e [tarefas](docs/tasks/README.md).
- **Arquitetura:** [visão geral](docs/arquitetura.md), [modelo de dados](docs/modelo-de-dados.md), [protocolo realtime](docs/protocolo-realtime.md) e [motor de partida](docs/motor-de-partida.md).
- **Multiplayer:** [sessões](docs/sessoes.md), [salas](docs/salas.md), [reconexão](docs/cenarios-de-reconexao.md) e [privacidade e concorrência](docs/privacidade-limites-e-concorrencia.md).
- **Experiência:** [interface](docs/interface.md), [avatares](docs/avatares.md), [acessibilidade](docs/acessibilidade.md), [sons](docs/sons.md) e [narrador](docs/narrador-robotico.md).
- **Editor de personagens:** [planejamento e futura adaptação ao Comicle](docs/plano-editor-personagens.md).
- **Partida:** [modo clássico](docs/modo-classico.md), [classificação e vidas](docs/classificacao-e-vidas.md), [final](docs/final-na-web.md), [desempate](docs/desempate-tiro.md) e [pódio e revanche](docs/podio-e-revanche.md).

## Licença e créditos

O código original do PENSHOW é distribuído sob a **[licença MIT](LICENSE)**.

Componentes, artes e conteúdo de terceiros mantêm suas respectivas licenças e atribuições. Consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [licenses/](licenses/), [data/sources.json](data/sources.json) e [data/licenses/](data/licenses/).

O projeto reutiliza partes da arquitetura e dos avatares do [Comicle](https://github.com/ninguemdev/Comicle). A dinâmica das fases tem como referência o [Brain Show](https://store.steampowered.com/app/2235150/), conforme a [documentação de referências](docs/referencia-brain-show.md).
