# Desenvolvimento local

O monorepo fornece quatro pacotes privados: `@penshow/web`, `@penshow/server`, `@penshow/shared` e `@penshow/e2e`. O conteúdo editorial permanece em `data/` e seus importadores em `scripts/`. A implementação das funcionalidades segue o [índice de tarefas](tasks/README.md).

## Instalação e execução

Use Node.js 24.15 ou superior da linha 24 e pnpm 12.9.1. A linha Node 24 fica registrada em `.nvmrc`; `engines` e `.npmrc` rejeitam versões incompatíveis. Se utilizar Corepack, `corepack enable` habilita os executáveis e o campo `packageManager` seleciona a versão do pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Não use `npm install` para instalar o monorepo. O `pnpm-lock.yaml` é próprio do PENSHOW e registra a resolução dos cinco manifests, incluindo a raiz. `strictPeerDependencies` rejeita combinações incompatíveis. Somente o script de instalação do esbuild é autorizado em `allowBuilds`. A exceção de idade mínima de `eslint@10.13.0` registra a versão explicitamente selecionada na instalação inicial; o restante segue as políticas padrão do pnpm.

`pnpm dev` compila shared e inicia os três observadores em paralelo. A web usa `127.0.0.1:5173`; a porta é estrita para evitar mudar silenciosamente a URL. O servidor usa `127.0.0.1:3000`. O Vite encaminha `/api/health` para `/health`, evitando depender de CORS no desenvolvimento. O cliente valida a resposta com o schema público e apresenta falha de conexão sem apagar a página.

`pnpm build` respeita a ordem das dependências: shared antes de server/web. `pnpm start` executa o JavaScript compilado do servidor. `pnpm --filter @penshow/web preview` serve os arquivos compilados para inspeção local, com o mesmo proxy do desenvolvimento. A hospedagem dos arquivos estáticos e seu proxy serão configurados em T34/T35.

O [quiz clássico da T15](quiz-classico.md) está conectado aos comandos Socket.IO quando `NODE_ENV` é `development` ou `test`, com uma fase de seis perguntas e conclusão explícita de protótipo. Em produção, o servidor não registra esses handlers. A [web da T16](quiz-classico-web.md) permite iniciar com dois jogadores conectados e atravessar perguntas, revelação e placar na rota da sala; a fase só muda por evento do servidor. A [T17](smoke-m2.md) acrescenta Playwright com duas identidades e projetos desktop/móvel: `pnpm --filter @penshow/e2e exec playwright install chromium` instala o navegador; `pnpm test:e2e` confere conteúdo, compila e executa o percurso. O job `smoke` da CI repete esse fluxo e guarda o relatório.

## Ferramentas verificadas

Versões diretas fixadas, consultadas no registro npm e instaladas em 16/10/2026:

| Ferramenta | Versão | Uso |
|---|---|---|
| pnpm | 12.9.1 | Workspace, scripts e lockfile |
| TypeScript | 6.0.3 | Tipagem de todos os pacotes |
| React / React DOM | 19.3.1 | Página inicial |
| Vite / plugin React | 8.3.4 / 6.1.2 | Desenvolvimento e bundle web |
| Fastify / CORS | 5.12.7 / 11.3.1 | HTTP, origem permitida e ciclo de vida |
| Socket.IO / cliente de teste | 4.8.4 | Transporte realtime e integração em rede |
| Zod | 4.6.7 | Contratos públicos e configuração do servidor |
| Vitest | 5.0.5 | Suítes dos três pacotes |
| ESLint / typescript-eslint | 10.13.0 / 8.71.2 | Qualidade e fronteiras |
| Prettier | 3.9.10 | Formatação |

TypeScript 6.0.3 atende ao intervalo suportado por typescript-eslint 8.71.2 (`>=4.8.4 <6.1.0`); a versão mais recente do compilador não foi escolhida por esse motivo. Node 24.15 atende também ao requisito do jsdom usado nos testes da web. As bases de configuração seguem as documentações de [Vite](https://vite.dev/guide/), [Vitest](https://vitest.dev/guide/), [TypeScript](https://www.typescriptlang.org/tsconfig/) e [Fastify](https://fastify.dev/docs/latest/Guides/Getting-Started/).

Zustand 5.0.15 coordena sessão, perfil, associação à sala e ações de lobby na web; Socket.IO Client 4.8.4 conecta o navegador ao transporte autenticado. `@testing-library/user-event` verifica teclado e interações, incluindo criação/convite e controles do lobby. Tailwind continua sem consumidor necessário: a interface provisória usa CSS nativo. Consulte [interface](interface.md) para navegação, caminho base, componentes e armazenamento, e [servidor](servidor.md) para configuração e portas injetáveis. Não há banco nesta base.

## Qualidade e fronteiras

`tsconfig.base.json` habilita `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, tratamento de sobrescrita e rejeição de declarações não usadas. Shared e servidor compilam ESM com NodeNext; a web usa a resolução Bundler do Vite. O servidor admite as APIs ES2024 presentes no Node 24, incluindo o suporte usado pelos testes de trabalho assíncrono. Configurações e testes também passam por tipagem; os builds do servidor e de shared excluem os testes, e o servidor exclui `test-support/`.

Os scripts editoriais importam os schemas privados TypeScript usando a remoção nativa de tipos do Node 24, sem exigir um build anterior ou duplicar validadores. Esses módulos usam sintaxe apagável. `rewriteRelativeImportExtensions` no servidor converte seus imports relativos `.ts` para `.js` no artefato compilado; a execução de produção continua em JavaScript. A validação de tipos permanece no `pnpm typecheck`, pois executar os scripts não faz checagem de tipos.

O ESLint aplica regras de JavaScript/TypeScript, hooks React e Fast Refresh e verifica importações por camada:

- Shared não importa apps, dados editoriais, Node, UI ou transporte.
- A web não importa servidor nem dados editoriais; componentes `.tsx` e arquivos de `ui/` não importam o socket.
- Arquivos de domínio do servidor (`domain/`, `domain.ts` ou `*.domain.ts`) não importam Node, UI, transporte ou `platform/`. Os próximos módulos devem manter essas convenções para receber a restrição.

As restrições verificam importações estáticas. Na revisão, manter também o sentido das dependências indiretas: componentes usam ações das stores; domínio recebe portas explícitas; nenhum adaptador pode reexportar dados privados para a web.

Prettier cobre código, configurações e README da raiz. `data/` e `docs/` ficam fora da reformatação automática para preservar conteúdo e planejamento existentes. Os importadores reutilizam parser e normalização existentes; a validação editorial agora é compartilhada com o servidor e inclui testes de promoção, recusa e publicação determinística.

## Comandos e CI

| Comando | Verificação |
|---|---|
| `pnpm format:check` | Formatação |
| `pnpm lint` | Qualidade por camada, sem avisos |
| `pnpm typecheck` | Tipagem estrita dos pacotes, testes e configurações |
| `pnpm test:content` | Parser, validação e publicação editorial em Node |
| `pnpm test:assets` | Integridade/procedência das artes e falhas do verificador |
| `pnpm test` | Conteúdo, artes e todas as suítes Vitest |
| `pnpm avatars:check` | Catálogo público e 50 artes de personagem |
| `pnpm questions:validate` | Candidatos/revisados, duplicatas, manifesto, licenças e regras de aprovação |
| `pnpm questions:publish` | Gera catálogo privado e relatório de revisão, sem aprovação automática |
| `pnpm questions:check` | Confere artefatos editoriais determinísticos, sem escrever |
| `pnpm build` | Compilação e bundle dos três pacotes |
| `pnpm test:e2e` | Catálogo, build e dois smokes reais em Playwright |
| `pnpm test:e2e:run` | Smokes com o build já pronto; usado pela CI |

`typecheck` e `test` compilam shared antes de resolver os seus exports, funcionando também antes do primeiro build completo. `test:assets` e `avatars:check` também compilam shared; seu JSON público de catálogo é copiado pelo TypeScript com `resolveJsonModule`. Cada pacote tem sua configuração Vitest e sua suíte real. O workflow `.github/workflows/ci.yml` instala com `--frozen-lockfile` e executa todos os checks de qualidade, perguntas e artes acima em Linux. A execução hospedada depende de enviar o branch ao GitHub. O sistema de [avatares](avatares.md) não acrescenta dependências de execução ou Canvas.

A CI executa `questions:check`, sem executar `questions:publish`. Distribua `data/questions/published/catalog.json` junto ao servidor; ele é validado no startup, e não é copiado para a web. O Vite mantém suas exclusões padrão e bloqueia também `data/questions/**`, relatórios de importação/publicação e `apps/server/**` em `/@fs`, evitando servir conteúdo privado por acesso direto no desenvolvimento. Um teste com servidor Vite real verifica HTTP 403 e confirma que a página, o módulo web e shared continuam acessíveis.

Os importadores continuam acessíveis por `pnpm questions:import` e `pnpm questions:import:opentdb --amount=1000`; os nomes anteriores em `npm run` também permanecem. A importação acessa fontes externas e altera candidatos, relatórios e manifesto; não é executada pela CI. Os 1.531 candidatos originais mantêm seus status pendentes. A T11 publica 72 cópias revisadas, com referências e decisões no [relatório editorial](revisao-editorial-t11.md), sem alterar os candidatos ou o manifesto de importação.
