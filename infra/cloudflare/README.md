# Rotas públicas do PENSHOW

**Publicado e validado em 26/10/2026:** [https://dionel.site/penshow/](https://dionel.site/penshow/). Versão do Worker: `057e96a1-d044-4fe1-abad-10685f2e98c7`. Cinco jogadores, convite, início do clássico e reconexão passaram em desktop e celular emulado; WebSocket e polling autenticado também passaram. As três rotas anteriores do Comicle conservaram seus IDs e vínculos.

O Worker `penshow-proxy` encaminha o PENSHOW para a instalação existente em `comicle-origin.dionel.site`. O arquivo [wrangler.jsonc](wrangler.jsonc) declara a variável de origem e somente estas rotas:

| Zona          | Rota                    |
| ------------- | ----------------------- |
| `dionel.site` | `dionel.site/penshow`   |
| `dionel.site` | `dionel.site/penshow/*` |

O servidor já permite a origem `https://dionel.site`. A configuração não exige alterar registros DNS, o Worker do Comicle ou o projeto Pages do portfólio. API e WebSocket usam os caminhos `/penshow/api/` e `/penshow/socket.io/`, cobertos pela segunda rota.

## Publicação pelo computador de desenvolvimento

Wrangler 4.152.0 foi usado para conferir o pacote. Na raiz do projeto:

```powershell
npm exec --yes --package=wrangler@4.152.0 -- wrangler deploy --config infra/cloudflare/wrangler.jsonc --dry-run
npm exec --yes --package=wrangler@4.152.0 -- wrangler login --device --browser=false --use-keyring --scopes account:read user:read workers:write workers_scripts:write workers_routes:write zone:read
```

O segundo comando mostra um código temporário e a página oficial de autorização. Entrar na conta que administra `dionel.site` e autorizar o Wrangler. O código expira em cinco minutos; gerar outro se necessário. A autenticação fica no armazenamento de credenciais do computador, fora do repositório. No Windows, `--use-keyring` requer `@napi-rs/keyring@1.3.0`, já instalado neste computador.

Antes de uma atualização, conferir a conta, a zona e as rotas existentes. O `account_id` de `wrangler.jsonc` fixa a conta proprietária de `dionel.site`, verificada na implantação. O Worker `penshow-proxy` já existe e é gerenciado por esta configuração; conferir a versão remota antes de substituir alterações feitas fora do repositório.

```powershell
npm exec --yes --package=wrangler@4.152.0 -- wrangler deploy --config infra/cloudflare/wrangler.jsonc
```

O arquivo local é a fonte de configuração para futuras publicações. Alterações de variáveis ou rotas feitas no painel devem ser refletidas nele antes de um novo deploy.

## Alternativa pelo painel

1. Em **Workers & Pages**, criar um Worker chamado `penshow-proxy` com o exemplo Hello World.
2. Em **Edit code**, substituir o código pelo conteúdo integral de [worker.mjs](worker.mjs) e publicar.
3. Em **Settings → Variables and Secrets**, adicionar uma variável de texto chamada `ORIGIN_HOST`, com valor `comicle-origin.dionel.site`, e publicar a alteração.
4. Em **Settings → Domains & Routes → Add → Route**, selecionar a zona `dionel.site` e adicionar `dionel.site/penshow`.
5. Repetir para `dionel.site/penshow/*`.

Usar **Route** para associar os dois caminhos. Não usar um domínio personalizado para a raiz inteira de `dionel.site`, que já hospeda o portfólio. As rotas `/comicle*`, `/api/*` e `/socket.io/*` existentes continuam vinculadas ao Comicle.

## Validação e retorno

Após a ativação, `https://dionel.site/penshow/api/health` deve responder JSON `{"service":"penshow","status":"ok"}`, e `https://dionel.site/penshow/` deve exibir o jogo. Um HTTP 200 com HTML do portfólio indica que o encaminhamento ainda não está ativo.

```powershell
$env:PENSHOW_DEPLOY_URL='https://dionel.site/penshow/'
corepack pnpm --filter @penshow/e2e exec playwright test tests/deployed-smoke.spec.ts --output=test-results/cloudflare-pilot --reporter=list
```

Conferir também WebSocket, polling, arquivos privados e as páginas do Comicle e do portfólio. Para desfazer somente esta publicação na Cloudflare, remover as duas rotas de `penshow-proxy`. A instalação da VM continua acessível em `https://comicle-origin.dionel.site/penshow/`.

Referências oficiais: [autenticação Wrangler](https://developers.cloudflare.com/workers/wrangler/commands/general/#login), [rotas](https://developers.cloudflare.com/workers/configuration/routing/routes/) e [variáveis](https://developers.cloudflare.com/workers/configuration/environment-variables/).
