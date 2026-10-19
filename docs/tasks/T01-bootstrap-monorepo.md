# T01 — Bootstrap do monorepo e qualidade

- **Depende de:** —
- **Pacotes:** raiz, web, server, shared
- **Marco:** M1
- **Branch sugerido:** `task/01-bootstrap-monorepo`

O status desta tarefa fica somente no [índice](README.md). As entregas verificadas estão marcadas abaixo, com evidências ao final.

## Objetivo

Criar a base executável do PENSHOW com os três pacotes do Comicle, ferramentas de qualidade e instalação reproduzível.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [analise-comicle.md](../analise-comicle.md)

## Entregáveis

- [x] Configurar `pnpm-workspace.yaml`, `@penshow/web`, `@penshow/server` e `@penshow/shared`, versões verificadas e lockfile próprio.
- [x] Ativar TypeScript estrito, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ESLint por camada e Prettier.
- [x] Disponibilizar scripts reais de desenvolvimento, build, tipagem, testes e validação de conteúdo, preservando os importadores existentes.
- [x] Configurar Vitest por pacote e CI inicial de instalação com lockfile, qualidade, testes e build; ampliar os checks nas tarefas seguintes.

## Critérios de aceite

- [x] Instalação em checkout limpo inicia web e servidor, e os dois consomem o pacote compartilhado.
- [x] Scripts existentes de importação e validação continuam utilizáveis; não criar comandos de sucesso fictício para funcionalidades futuras.
- [x] Domínio não importa transporte ou UI; shared não importa apps; componentes não importam o socket.
- [x] Não introduzir banco, editor de quadrinhos ou histórico do Comicle para satisfazer a estrutura.

## Verificação

- [x] Executar instalação reproduzível, build, lint, tipagem e os oito testes de conteúdo existentes.
- [x] Verificar o comportamento real do endpoint mínimo de saúde e o carregamento da web; evitar testes que apenas repetem configuração.

## Cuidados de implementação

Reaproveitar padrões de configuração do Comicle seletivamente. Cada pacote recebe apenas as dependências usadas; a raiz permanece privada como pacote.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 16/10/2026

- Ambiente: Windows, Node.js 24.18.0, pnpm 12.9.1; branch `task/01-bootstrap-monorepo`.
- Instalação com `pnpm install --frozen-lockfile` em cópia limpa dos arquivos versionáveis, sem `node_modules` ou `dist` prévios. Nenhuma alteração de resolução foi necessária. `pnpm dev` iniciou shared em observação, Vite em `127.0.0.1:5173` e Fastify em `127.0.0.1:3000`.
- `GET /health` direto e `GET /api/health` pelo proxy responderam HTTP 200 com `{"service":"penshow","status":"ok"}`. O servidor e o cliente usam o schema de `@penshow/shared` em execução.
- Chrome em modo headless carregou a aplicação de desenvolvimento e exibiu `Servidor conectado.` após a consulta real. O mesmo foi verificado com servidor compilado (`node apps/server/dist/main.js`) e `vite preview`. Sem o servidor, o preview preservou o título e exibiu o aviso de indisponibilidade.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` e `pnpm build` passaram. Build, tipagem e testes também passaram na cópia limpa.
- `pnpm test`: **20 testes passaram** — oito de conteúdo preservados, seis do contrato compartilhado, um do healthcheck HTTP e cinco da página (carregamento, sucesso, falha de rede, erro HTTP e resposta incompatível).
- `pnpm questions:validate`: **1.531 candidatos válidos estruturalmente**, com 531 em pt-BR aguardando revisão e 1.000 em inglês aguardando tradução. Os arquivos de conteúdo não foram alterados e não foram executadas novas coletas remotas.
- Sondagens via API do ESLint rejeitaram importações de app em shared, Fastify em domínio e Socket.IO em componente, sem criar arquivos de teste artificiais.
- CI configurada em `.github/workflows/ci.yml` para instalação congelada, formatação, lint, tipagem, testes, catálogo e build. O workflow hospedado ainda não foi executado; depende de enviar o branch ao GitHub.

Consulte [desenvolvimento](../desenvolvimento.md) e o [README da raiz](../../README.md) para comandos, versões e limites desta base. Contratos de jogo, infraestrutura realtime e navegação completa permanecem nas tarefas seguintes.
