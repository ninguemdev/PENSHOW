# PENSHOW junto do Comicle

Piloto instalado em **26/10/2026** na VM `comicle-prod` (`i-05748174e8c875a20`, `us-east-2`, `c7i-flex.large`), usando o Caddy existente do Comicle. Acesso verificado: [https://dionel.site/penshow/](https://dionel.site/penshow/). As duas rotas Cloudflare estão ativas no Worker `penshow-proxy`; o hostname de origem também continua acessível. As [evidências reais](../../docs/validation/t35-piloto-compartilhado.md) registram hashes, backup e testes; confirmar novamente a configuração antes de futuras instalações.

O ambiente instalado em `/opt/penshow/.env` permite `https://dionel.site,https://comicle-origin.dionel.site` em `ALLOWED_ORIGINS`. O instalador preserva esse arquivo nas atualizações; o exemplo do bundle continua com o domínio principal. O backup desta instalação está em `/opt/penshow/backup-20261026T132311Z-ASVdj0`.

O PENSHOW usa um projeto Compose próprio, sem banco, sem volumes do Comicle e sem publicar portas no host. Liga-se à rede do Caddy com o alias `penshow`. Seus caminhos são `/penshow/`, `/penshow/api/` e `/penshow/socket.io/`. `/comicle/`, `/api/` e `/socket.io/` continuam no Comicle.

## Antes da instalação

Na sessão do AWS Systems Manager, conferir apenas informações operacionais:

```sh
uname -m
free -h
df -h / /opt
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
sudo docker network ls
```

A imagem preparada localmente é `linux/amd64`; a VM deve reportar `x86_64`. Confirmar que o Caddy continua no projeto `comicle`, com os arquivos em `/opt/comicle` e rede `comicle_default`. O instalador recusa um Caddyfile diferente do modelo conhecido, em vez de sobrescrevê-lo sem análise. Não compartilhar `.env`, chaves, certificados privados ou credenciais AWS.

## Bundle privado

O bundle local contém imagem Docker, Compose, exemplo de ambiente, instalador, gerador de candidato Caddy e Worker. Não exige compilação nem acesso ao repositório na VM. Seu catálogo fica privado dentro da imagem; o arquivo de distribuição não deve ser publicado em bucket aberto ou registro público.

Transferir `penshow-pilot-20261026.tar.gz` e seu arquivo `.sha256` por um canal privado para a VM. Na pasta que contém os dois arquivos:

```sh
sha256sum -c penshow-pilot-20261026.tar.gz.sha256
sudo install -d -m 0750 /opt/penshow-releases
sudo tar -xzf penshow-pilot-20261026.tar.gz -C /opt/penshow-releases
cd /opt/penshow-releases/penshow-pilot-20261026
```

Conferir `.env.example` antes da primeira instalação: imagem, origem HTTPS pública e rede existente do Caddy. Se `/opt/penshow/.env` já existe, ele é preservado e deve apontar para a imagem deste bundle.

```sh
sudo bash install.sh
sudo docker compose --project-name penshow --env-file /opt/penshow/.env --file /opt/penshow/compose.yaml ps
```

O instalador confere o Comicle, guarda backup do Caddyfile, carrega a imagem, inicia somente o PENSHOW e valida um candidato com o Caddy existente. Antes de aplicar, verifica se o original mudou durante a preparação. Mantém o inode do arquivo montado e recarrega o Caddy; não recria o app ou banco do Comicle. Se o reload ou as conferências seguintes falharem, restaura o Caddyfile anterior. Conexões WebSocket podem reconectar durante o reload do proxy.

Depois, confere `/comicle/`, `/penshow/`, a saúde do PENSHOW na origem e que o container Comicle não foi reiniciado. Esse teste local usa `--insecure` somente com `--resolve` para o loopback, pois o certificado Origin CA é destinado à Cloudflare. O tráfego público continua sujeito a TLS na Cloudflare e à política existente da origem.

## Rotas da Cloudflare

A configuração publicada e o passo a passo de autenticação/painel estão em [infra/cloudflare](../cloudflare/README.md). O arquivo `infra/cloudflare/wrangler.jsonc` declara o Worker `penshow-proxy`, a variável de origem e as duas rotas abaixo.

O Worker `penshow-proxy` foi publicado com `cloudflare/worker.mjs` e a variável `ORIGIN_HOST=comicle-origin.dionel.site`. Estão associadas somente:

- `dionel.site/penshow`
- `dionel.site/penshow/*`

Preservar o Worker, as rotas e o DNS do Comicle e do portfólio. O Worker do PENSHOW preserva corpo, cabeçalhos de autenticação/Origin e upgrade WebSocket. Rotas externas ao seu prefixo são recusadas.

## Conferência pública e retorno

Conferir `https://dionel.site/comicle/`, `https://dionel.site/penshow/` e `https://dionel.site/penshow/api/health`. No computador de desenvolvimento:

```sh
PENSHOW_DEPLOY_URL=https://dionel.site/penshow/ pnpm --filter @penshow/e2e exec playwright test tests/deployed-smoke.spec.ts
```

O teste cria cinco sessões independentes, entra por convite, inicia o modo clássico, confere as cinco fases e reconecta uma sessão. Testa desktop e celular emulado; não substitui uma partida completa observada com pessoas.

Para retirar o piloto, remover apenas suas duas rotas Cloudflare e parar somente o serviço do projeto `penshow`. O backup Caddy fica em `/opt/penshow/backup-*/Caddyfile.original`; selecionar o backup desta instalação, restaurar seu conteúdo no arquivo existente e validar/recarregar o proxy. Nunca remover os volumes ou executar `down` no projeto `comicle`.

Este é um piloto de 348 perguntas revisadas, com partidas habilitadas explicitamente por `GAMEPLAY_ENABLED=true` e `NODE_ENV=production`. A meta de 5.000 e os aceites presenciais continuam pendentes; preparar o bundle não conclui a publicação T35.
