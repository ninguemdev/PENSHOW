# Build, container e operação

A T34 entrega uma imagem independente do provedor, com web, HTTP e Socket.IO no mesmo processo Node.js. O destino, domínio e acesso continuam em D08/T35. Não houve publicação externa.

**Produção ainda oferece perfil, salas e lobby; as partidas experimentais continuam desativadas.** T29/T36 e as decisões D02–D06 permanecem pendentes. O smoke executa uma partida curta na mesma imagem com `NODE_ENV=test`, somente em loopback, sem mudar a política de produção. Isso verifica o artefato e não conclui a liberação do jogo ou a meta editorial de 5.000 perguntas da T33.

## Executar localmente

Com Docker Engine e Compose disponíveis, a partir da raiz:

```sh
docker compose --env-file infra/production.env.example up --build --detach --wait
docker compose ps
docker compose logs --tail=100 penshow
```

Abra `http://127.0.0.1:8080/penshow/`. Saúde: `http://127.0.0.1:8080/api/health`, com `{"service":"penshow","status":"ok"}`. O Compose publica somente em loopback, usa filesystem somente leitura, usuário `node`, init, descarte de capabilities e logs com rotação. Não precisa de volumes graváveis, banco ou credenciais. `restart: unless-stopped` reinicia processos que caem; estado `unhealthy` sozinho não provoca reinício automático.

Para encerrar, use `docker compose down`. Qualquer parada ou substituição encerra salas, partidas e sessões; avise o grupo antes. Não executar esse comando para apenas inspecionar uma instalação em uso.

Construção e teste separados:

```sh
docker build --tag penshow:local .
pnpm install --frozen-lockfile
pnpm --filter @penshow/shared build
pnpm test:container penshow:local
```

O smoke exige Node 24, dependências de desenvolvimento instaladas no host e Docker acessível. Ele cria containers próprios com nomes únicos, testa produção e a mesma imagem em modo de teste local, e os remove ao terminar. A imagem final inicia com `node apps/server/dist/main.js`, sem pnpm, TypeScript, Vite ou Vitest no grafo de dependências da aplicação. Node e o gerenciador de pacotes da imagem oficial de base continuam disponíveis.

## Artefato reproduzível e conteúdo

O Dockerfile fixa Node 24.18.0/bookworm-slim por digest multiarch e pnpm 12.9.1. O builder instala pelo lockfile, verifica publicação e 50 artes, compila shared/server/web e usa `pnpm deploy --prod` para produzir as dependências portáveis do servidor, incluindo shared. Atualizações desses pins precisam de nova validação e build.

Somente o estágio final é distribuído. Inclui:

- `apps/server/dist` e dependências de execução, sem fontes/testes próprios ou ferramentas de desenvolvimento;
- `apps/web/dist`, com os 50 PNGs de avatar, licenças públicas, HTML e JS/CSS gerados;
- `data/questions/published/catalog.json`, privado, atualmente com 336 aprovadas;
- `data/narration/generated`, com WAVs/manifesto privados do narrador robótico, preparados no builder;
- `data/sources.json`, `data/licenses`, `licenses` e `THIRD_PARTY_NOTICES.md`, preservando procedência e atribuição.

Candidatos, revisões, lotes editoriais, relatórios, `.env`, `.git` e instruções locais de assistentes não integram o runtime. O catálogo fica fora da raiz estática. Não montar `data/`, a raiz do repositório ou diretórios do servidor como arquivos públicos. O builder recebe os insumos editoriais para conferir a publicação; não compartilhar os estágios intermediários como imagem de execução.

O servidor só publica HTML, assets JS/CSS, avatares PNG e licenças TXT da raiz web. Mapas, JSON, dotfiles, arquivos ausentes e caminhos de outros serviços recebem erro, sem fallback indiscriminado para HTML. O smoke inspeciona o filesystem da imagem, testa rotas privadas e procura os enunciados aprovados nos scripts públicos. A exposição das respostas em cada fase continua protegida pelas projeções e pelos testes de T28/T29.

## Caminhos e variáveis

| Variável | Uso |
|---|---|
| `NODE_ENV` | `production` na imagem e no Compose. `test`/`development` habilitam regras experimentais; usar apenas em testes privados. |
| `NARRATION_ENABLED` | `true` em desenvolvimento/produção e `false` por padrão nos testes. Gerações de áudio fazem parte do build; detalhes no [guia do narrador](narrador-robotico.md). |
| `HOST` | `0.0.0.0` dentro da imagem; fora dela o padrão é `127.0.0.1`. |
| `PORT` | `3000` interno; ao alterar, ajustar também o mapeamento de portas. O healthcheck lê a mesma variável. |
| `ALLOWED_ORIGINS` | Obrigatória em produção: origens HTTP(S) exatas separadas por vírgula, sem caminho ou barra final. Exemplo: `https://penshow.example`. |
| `WEB_ROOT` | `/app/apps/web/dist` na imagem. Opcional fora dela; precisa ser caminho absoluto para o cliente compilado. Ausente: servir somente API/socket. |
| `WEB_BASE_PATH` | `/penshow/` por padrão. Deve coincidir com a base gravada no build. Caminhos absolutos terminados em `/`; `/api/` e `/comicle/` são reservados. |
| `VITE_BASE_PATH` | Somente build web. No Docker, vem do argumento `WEB_BASE_PATH`. Não contém segredo. |
| `HTTP_BODY_LIMIT` / `SOCKET_MESSAGE_LIMIT` | `65536` bytes, limites validados de 1024 a 1048576. |
| `GUEST_SESSION_TTL_MS` | `86400000`, janela de renovação da sessão em memória. |
| `LOG_LEVEL` | `info` na imagem; níveis descritos em [servidor](servidor.md). |
| `PENSHOW_IMAGE` | Interpolação do Compose para selecionar uma tag/digest de imagem. Não é configuração do servidor. |

`infra/production.env.example` contém somente exemplos sem credenciais. Compose lê essas variáveis para interpolação; Node não carrega `.env` automaticamente. Para alterar limites/TTL no Compose, acrescentar as variáveis ao bloco `environment` do serviço. Nunca colocar credenciais em argumentos de build ou variáveis `VITE_*`.

Outro caminho HTML exige recompilar e configurar a mesma base em runtime:

```sh
docker build --build-arg WEB_BASE_PATH=/jogos/penshow/ --tag penshow:subpath .
docker run --rm --init --read-only --cap-drop ALL --security-opt no-new-privileges:true --publish 127.0.0.1:8080:3000 --env ALLOWED_ORIGINS=http://127.0.0.1:8080 penshow:subpath
```

O argumento também grava `WEB_BASE_PATH` no estágio final. A URL do exemplo será `/jogos/penshow/`. A API permanece em `/api/` e o transporte em **`/penshow/socket.io`**, independente da base HTML. Não encaminhar `/comicle/` ao PENSHOW nem compartilhar seus tokens/chaves locais. Uma divergência de base/HTML é recusada antes de abrir a porta.

Sem Docker, após `pnpm install --frozen-lockfile`, `pnpm questions:check` e `pnpm build`, é possível iniciar `node apps/server/dist/main.js` com `NODE_ENV`, `ALLOWED_ORIGINS` e, para servir a interface, `WEB_ROOT` absoluto e `WEB_BASE_PATH=/` (base padrão do build local). Para distribuir fora do checkout, preservar o layout da imagem; `DEFAULT_CATALOG_FILE` é relativo ao módulo compilado e não ao diretório atual.

## Proxy, WebSocket e HTTPS

[infra/nginx.conf.example](../infra/nginx.conf.example) é um exemplo para o contexto `http` do Nginx, com domínio/certificados fictícios. O proxy mantém os caminhos `/penshow/`, `/api/` e `/penshow/socket.io/`; a localização do socket tem prioridade e preserva upgrade, polling e timeouts. Como o próprio servidor já atende `/api`, esse exemplo não remove o prefixo. O proxy Vite de desenvolvimento continua removendo `/api` e usa as rotas históricas sem prefixo.

Antes de publicar: definir domínio e certificados reais, configurar `ALLOWED_ORIGINS` com a origem HTTPS visível no navegador, validar `nginx -t`, encaminhar HTTP para HTTPS e testar o certificado, o polling e o upgrade WebSocket no destino real. A T34 testa HTTP/socket no container em loopback; emissão/renovação de certificado e TLS no provedor são validações de T35. O app confia no peer direto, sem habilitar `trustProxy`; atrás do proxy os limites por IP são compartilhados entre seus usuários. Não confiar cegamente em `X-Forwarded-For`; configurar política de proxy conhecido somente quando houver destino concreto.

HTML exige revalidação (`no-cache`); JS/CSS com hash têm cache de um ano e `immutable`; avatares/licenças têm cache público de uma hora. API e erros usam `no-store`. O proxy deve respeitar esses cabeçalhos, sem cachear sessões ou polling. Instalar uma versão nova pode invalidar assets em abas antigas: recarregar a página atualiza o cliente.

## Saúde, logs e encerramento

O healthcheck só responde após carregar/validar o catálogo e validar o build web configurado. Ele verifica disponibilidade básica do processo; não promete estoque suficiente para uma partida ou recuperação do estado. Na imagem, consulta `/api/health` a cada 15 segundos, com timeout de 3 segundos e três falhas toleradas após a janela inicial.

Configuração inválida, catálogo ausente/corrompido ou base incompatível encerram com código 1. Corrigir o artefato/configuração e recriar o container; não publicar catálogo vazio para esconder o erro. Falhas de catálogo têm mensagem fixa sem imprimir perguntas, gabaritos ou caminhos privados.

Logs JSON vão a stdout/stderr, com nível configurável e sem corpos, tokens, respostas ou stack privada. Use `docker compose logs --tail=100 penshow`; o Compose limita cada arquivo a 10 MB e mantém três. O exemplo Nginx desativa access log para não registrar queries. Se houver observabilidade no destino, manter a mesma privacidade.

SIGINT/SIGTERM chamam `app.close()`: novas operações são bloqueadas, filas encerram, timers são cancelados e conexões são fechadas. Após drenar o trabalho de domínio e o realtime no `preClose`, o servidor fecha também conexões HTTP ativas; um upload incompleto não mantém a parada bloqueada. Conexões TCP que sofreram upgrade para WebSocket recebem até um segundo para fechar; as restantes são destruídas, inclusive quando o cliente não confirma o fechamento WebSocket. Os logs identificam início e conclusão do encerramento. O Compose concede 15 segundos antes de SIGKILL. Não há checkpoint de salas, sessões, placares ou vidas em disco: reinício elimina tudo, tokens antigos recebem 401 e o cliente precisa de uma sessão nova. Uma desconexão de rede sem reinício segue a recuperação em memória de [reconexão](cenarios-de-reconexao.md).

## Atualizar e voltar à versão anterior

Criar tags por versão/commit e guardar o digest anterior. Preparar e testar a imagem antes de trocar uma instância em uso. O Compose tem um único processo; não iniciar réplicas sobre o mesmo estado em memória.

Para trocar por uma imagem já obtida, exporte `PENSHOW_IMAGE` com a tag/digest desejado no shell ou em um arquivo de ambiente próprio e execute:

```sh
docker compose up --detach --no-build --wait
docker compose ps
```

Para rollback, selecione a tag/digest anterior e repita o comando. Esse retorno restaura código/conteúdo da imagem, **não** salas e sessões perdidas. Sem banco, não há migração ou restauração de partida. Não usar rollback como promessa de continuidade para os jogadores.

## Verificação automatizada

O job `container` da CI constrói a imagem a partir do checkout com lockfile e executa `pnpm test:container`. O roteiro cobre HTTP, caminhos de recarga da SPA, cache, CORS, catálogo privado, usuário sem root, dependências de runtime, 50 artes, healthcheck do Docker, WebSocket e polling autenticados, parada com código 0, reinício sem recuperar tokens/salas e falhas de startup com código 1. Na mesma imagem em teste local, duas identidades jogam seis perguntas sem acesso ao gabarito antecipado e voltam ao lobby com o placar calculado pelas revelações.

Referências de implementação: [Fastify Static](https://github.com/fastify/fastify-static), [deploy portátil do pnpm](https://pnpm.io/cli/deploy), [Docker com pnpm](https://pnpm.io/docker) e [proxy WebSocket do Nginx](https://nginx.org/en/docs/http/websocket.html).
