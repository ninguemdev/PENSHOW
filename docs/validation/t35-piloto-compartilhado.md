# T35 — Implantação do piloto na VM do Comicle

Data: 26/10/2026. **Piloto instalado e validado na VM real**, via MCP oficial AWS e Systems Manager, conforme pedido do usuário. Acesso: [https://dionel.site/penshow/](https://dionel.site/penshow/). Instância `comicle-prod`, `i-05748174e8c875a20`, `us-east-2`, tipo `c7i-flex.large`, Ubuntu 24.04/x86_64. O container está saudável, com partidas e narração habilitadas em produção. Comicle e portfólio continuam acessíveis. `https://dionel.site/penshow/` já exibe o jogo pelo Worker `penshow-proxy`, com duas rotas publicadas e verificadas.

## Conexão MCP — histórico e verificação real

Foi adicionado o servidor global `aws-mcp`, com endpoint oficial `https://aws-mcp.us-east-1.api.aws/mcp?oauth=initialize`. O Codex retornou `Successfully logged in` e listou o servidor como `enabled`, com autenticação `OAuth`. Nenhuma senha, token ou URL temporária de autorização foi incluída no repositório.

Na sessão anterior, iniciada antes do cadastro, o runtime respondeu `unknown MCP server 'aws-mcp'`. Na execução atual, as ferramentas ficaram disponíveis e foram verificadas com STS, descoberta EC2 nas 17 regiões habilitadas e SSM. A conta apresentou uma única instância, `comicle-prod`; o agente SSM estava online. A identidade utilizada pelo MCP foi a raiz da conta; a verificação confirmou a identidade sem alterar IAM ou credenciais.

A tentativa anterior de instalar AWS CLI no Windows foi rejeitada pela revisão automática com `blocked by policy`, antes de executar. Esse bloqueio de instalação não era erro de conexão com a VM. O MCP remoto com OAuth foi configurado depois, sem instalar AWS CLI.

## Artefato preparado

- Imagem: `penshow:pilot-20261026`, `linux/amd64`.
- ID: `sha256:c9ba885f531983640d4f2dd73a1cfab531db54a293591f4148a9a78042d75ade`.
- Catálogo: 348 perguntas, `manifest.contentSha256` igual a `246b223566b0f800cbb5ad1b63bf605a7844193a0de73a6bf2061c70c8ec088f`; 348 narrações. O SHA-256 dos bytes do arquivo `catalog.json`, distinto do hash canônico de conteúdo, é `c6fd3edff5a13fe176703cbd025cc77257b8a08fb5c3c7ef01a81641261e0485`, conferido no checkout e no container da VM.
- Bundle privado: `.local-releases/penshow-pilot-20261026.tar.gz`, com imagem, configuração e instalador. O `.sha256` adjacente permite conferir a transferência; arquivos internos têm `checksums.sha256`.
- SHA-256 do bundle: `770ba9a6d222cfeae69bb37feffda35b2f4b1b8798227a732f13acb3821b303e`.

O bundle foi gerado da árvore local com alterações não commitadas, sem publicar imagem ou conteúdo em registro/bucket público. A pasta de artefatos está excluída de Git e do contexto Docker. A instalação é identificada como piloto, sem alegar a meta editorial de 5.000.

## Mudanças para coexistência

O cliente usa a API sob sua própria base: `/penshow/api/`, incluindo sessões e narração. O servidor mantém os aliases históricos e compartilha identidade e limites entre eles; não há orçamento adicional por mudar o prefixo. O socket permanece `/penshow/socket.io/`. Assim, `/api/` e `/socket.io/` do Comicle não precisam ser redirecionados.

`GAMEPLAY_ENABLED=true` habilita as partidas com `NODE_ENV=production`, mantendo validação de origem, configuração e privacidade. Sem liberação explícita, produção continua recusando o início. O Compose EC2 do piloto habilita a partida e usa projeto próprio, sem banco, volumes do Comicle ou portas públicas adicionais.

O gerador de candidato Caddy preserva o arquivo original e adiciona apenas o prefixo PENSHOW depois da restrição de origem. O instalador prepara backup, valida o candidato antes do reload, recusa alterações concorrentes e restaura o proxy se as verificações falharem. A sintaxe Bash e a lógica do candidato foram verificadas localmente; **o instalador também foi executado com sucesso na VM real** nesta implantação. O rollback está preparado, mas não foi necessário acioná-lo.

O Worker separado atende somente `/penshow` e `/penshow/*`, preservando método, corpo, credencial, Origin e upgrade WebSocket. As duas rotas foram ativadas e validadas na Cloudflare, conforme a seção de publicação abaixo. [Guia de instalação](../../infra/ec2/README.md).

## Verificações da preparação local

| Verificação | Resultado |
|---|---|
| Regressões antes da correção | Falhas reproduzidas: API no subcaminho ausente, prefixo HTTP incorreto e ausência da configuração de liberação |
| `pnpm test` | 917 aprovados: 50 conteúdo/infra, cinco artes, 193 shared, 486 servidor e 183 web |
| Tipos, build, lint e formatação | Aprovados; E2E teve tipos conferidos após a inclusão do teste de publicação |
| Docker build do piloto | Aprovado |
| `pnpm test:container penshow:pilot-20261026` | Aprovado: quiz de seis perguntas com duas identidades em produção habilitada; produção sem liberação continua recusando início |
| Integridade e runtime do container | 348 perguntas/narrações, 50 artes, hashes conferidos e arquivos privados ausentes das rotas/bundle web |
| Compose EC2 | Configuração validada; a rede externa será conferida na VM antes de iniciar |
| Worker | Quatro testes: API com corpo/autenticação/Origin, upgrade WebSocket, isolamento de caminhos e origem inválida |
| Caddy | Três testes: preservação de Comicle/TLS/restrição de origem, idempotência e recusa de ambiguidades |
| Proxy local com Caddy real e imagem do piloto | `/penshow/api/health` respondeu pelo PENSHOW; `/api/health` continuou na aplicação Comicle simulada; caminho desconhecido recusado |
| Playwright através desse proxy | Dois percursos aprovados sem retry, em 10,4 s: desktop e celular emulado, cinco sessões independentes por percurso, convite, início do clássico com cinco fases e recarga/reconexão |
| Comicle público | `https://dionel.site/comicle/` respondeu HTTP 200 durante a preparação; nenhuma alteração remota foi realizada |

Relatório local de navegador: `e2e/playwright-report/t35-pilot-proxy/index.html`. O teste usou aplicação PENSHOW e Caddy reais, com uma aplicação Comicle **simulada**, em rede Docker isolada; não representa publicação AWS, partida humana ou medição de latência na EC2. O [teste de publicação](../../e2e/tests/deployed-smoke.spec.ts) pode ser executado contra o destino real mediante `PENSHOW_DEPLOY_URL` explícita.

## Implantação real via AWS MCP/SSM

A inspeção inicial confirmou aproximadamente 12 GB livres no disco, 3,8 GB de RAM, rede `comicle_default` e instalação em `/opt/comicle`, com Caddy, app e Postgres em execução. O Caddyfile correspondeu ao modelo esperado pelo instalador. Não foram impressos `.env`, credenciais, certificados privados ou tokens de sessão.

O bundle de 141.623.783 bytes foi transferido por URLs S3 temporárias para um bucket privado, com bloqueio público completo e criptografia AES256. O hash do bundle e todos os hashes internos passaram na VM. Após a instalação, o objeto e o bucket temporários foram removidos. A imagem foi carregada localmente no Docker da VM, sem publicação em registro público.

O instalador iniciou apenas o projeto Compose `penshow`, ligado à rede existente, sem porta publicada no host. O candidato Caddy foi validado antes do reload e o backup ficou em `/opt/penshow/backup-20261026T132311Z-ASVdj0/Caddyfile.original`. A configuração instalada fica em `/opt/penshow/compose.yaml` e `/opt/penshow/.env`. O ambiente foi ajustado para permitir as origens exatas `https://dionel.site,https://comicle-origin.dionel.site`; somente o PENSHOW foi recriado nesse ajuste.

| Verificação no destino real | Resultado |
|---|---|
| Integridade do bundle e arquivos internos | SHA-256 conferidos, incluindo `image.tar` |
| Instalação SSM | Comando `4d408918-83d8-4522-b2f4-05bc1322429e`, `Success`, código 0 |
| Origens HTTPS do piloto | Comando `93a9a90a-f827-4991-8eea-2c87c620a115`, `Success`, código 0 |
| Runtime | `penshow-penshow-1`, imagem `penshow:pilot-20261026`, ID `sha256:c9ba885f531983640d4f2dd73a1cfab531db54a293591f4148a9a78042d75ade`, saudável, usuário `node`, filesystem somente leitura, reinício `unless-stopped` e nenhuma porta publicada no host |
| Caddy e saúde na origem | Candidato válido; `/penshow/`, `/penshow/api/health` e `/comicle/` aprovados |
| Comicle preservado | Mesmo ID do app e início `2026-10-26T12:19:00.566695931Z`; sem recriação do app ou Postgres |
| HTTPS público no hostname de origem | Saúde HTTP 200, corpo `{"service":"penshow","status":"ok"}`, certificado verificado pelo cliente |
| Playwright desktop | Aprovado, cinco identidades, convite, início do clássico e recarga/reconexão |
| Playwright celular emulado | Aprovado, mesmo percurso; dois testes no total, sem retry, em 27,5 s |
| Transporte público | WebSocket e polling forçados separadamente, autenticados, aprovados |
| CORS | Duas origens permitidas; origem alheia sem autorização CORS |
| Privacidade pública | Catálogo, manifesto privado, `.env` e código do servidor retornam HTTP 404 |
| Serviços existentes públicos | `https://dionel.site/comicle/` e portfólio na raiz respondem HTTP 200 com conteúdo esperado |
| Limpeza | Objeto e bucket temporários de transferência removidos; bundle privado preservado na VM para operação |

Comando de navegador executado no PowerShell, contra o destino real:

```powershell
$env:PENSHOW_DEPLOY_URL='https://comicle-origin.dionel.site/penshow/'
corepack pnpm --filter @penshow/e2e exec playwright test tests/deployed-smoke.spec.ts --output=test-results/aws-pilot --reporter=list
```

O registro local `e2e/test-results/aws-pilot/.last-run.json` indica `passed`, sem testes com falha. Esta execução usou o reporter de texto e não preservou as capturas anexadas como arquivos. O teste comprovou entrada e início da partida no ambiente publicado, sem executar uma partida humana completa nem medir equilíbrio em redes distintas.

## Publicação das rotas Cloudflare

Em 26/10/2026, após autorização OAuth do usuário, o Wrangler 4.152.0 publicou o Worker `penshow-proxy`, versão `057e96a1-d044-4fe1-abad-10685f2e98c7`, com `ORIGIN_HOST=comicle-origin.dionel.site`. A configuração reproduzível está em [wrangler.jsonc](../../infra/cloudflare/wrangler.jsonc), com a conta verificada fixada, endereços `workers.dev` e previews desativados e somente as duas rotas do PENSHOW.

O inventário antes e depois confirmou a preservação das três rotas existentes do Comicle (`dionel.site/comicle*`, `dionel.site/api/*` e `dionel.site/socket.io/*`), incluindo IDs e Worker associado. O Worker `comicle-proxy` conservou a data de modificação anterior; nenhum registro DNS ou projeto Pages foi alterado.

| Verificação no domínio principal | Resultado |
|---|---|
| `dionel.site/penshow` | Rota `b82eca09bcbd4414b4b47dee5175aea0`, vinculada a `penshow-proxy`; HTTP 308 para `/penshow/` |
| `dionel.site/penshow/*` | Rota `af94b7cb78824bba895d20270bf8c706`, vinculada a `penshow-proxy` |
| `/penshow/api/health` | HTTP 200 com JSON de saúde do PENSHOW |
| Playwright desktop e celular emulado | Dois testes aprovados, sem retry, em 27,0 s; cinco identidades por teste, convite, início do clássico e reconexão |
| WebSocket e polling | Conexões autenticadas verificadas separadamente em `https://dionel.site` |
| CORS e conteúdo privado | Origens autorizadas conferidas, origem alheia sem autorização; quatro caminhos privados retornam 404 |
| Comicle e portfólio | HTTP 200 com os conteúdos esperados |
| Preparação | Quatro testes do Worker aprovados e `wrangler deploy --dry-run` concluído |

```powershell
$env:PENSHOW_DEPLOY_URL='https://dionel.site/penshow/'
corepack pnpm --filter @penshow/e2e exec playwright test tests/deployed-smoke.spec.ts --output=test-results/cloudflare-pilot --reporter=list,html
```

Relatório local: `e2e/playwright-report/index.html`, com capturas dos cinco jogadores nos dois formatos. Resultado resumido: `e2e/test-results/cloudflare-pilot/.last-run.json`. Os inventários de rotas antes/depois ficam em `.local-releases/cloudflare-before-20261026.json` e `.local-releases/cloudflare-after-20261026.json`, sem tokens. As credenciais OAuth ficam criptografadas fora do repositório, com chave no Windows Credential Manager. Para desfazer apenas o encaminhamento, remover as duas rotas de `penshow-proxy`; o acesso pelo hostname de origem permanece disponível.

## Pendências

A publicação técnica na VM e no domínio principal foi concluída. O hostname de origem continua disponível para operação; as configurações reproduzíveis estão no [guia Cloudflare](../../infra/cloudflare/README.md) e no [guia EC2](../../infra/ec2/README.md).

A T35 permanece em andamento: versão completa de 5.000 perguntas, partida completa/revanche com pessoas e aceites globais não foram concluídos. T30–T33 conservam suas pendências.
