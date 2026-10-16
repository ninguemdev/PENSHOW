# T01 — Bootstrap do monorepo e qualidade

- **Depende de:** —
- **Pacotes:** raiz, web, server, shared
- **Marco:** M1
- **Branch sugerido:** `task/01-bootstrap-monorepo`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Criar a base executável do PENSHOW com os três pacotes do Comicle, ferramentas de qualidade e instalação reproduzível.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [analise-comicle.md](../analise-comicle.md)

## Entregáveis

- [ ] Configurar `pnpm-workspace.yaml`, `@penshow/web`, `@penshow/server` e `@penshow/shared`, versões verificadas e lockfile próprio.
- [ ] Ativar TypeScript estrito, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ESLint por camada e Prettier.
- [ ] Disponibilizar scripts reais de desenvolvimento, build, tipagem, testes e validação de conteúdo, preservando os importadores existentes.
- [ ] Configurar Vitest por pacote e CI inicial de instalação com lockfile, qualidade, testes e build; ampliar os checks nas tarefas seguintes.

## Critérios de aceite

- [ ] Instalação em checkout limpo inicia web e servidor, e os dois consomem o pacote compartilhado.
- [ ] Scripts existentes de importação e validação continuam utilizáveis; não criar comandos de sucesso fictício para funcionalidades futuras.
- [ ] Domínio não importa transporte ou UI; shared não importa apps; componentes não importam o socket.
- [ ] Não introduzir banco, editor de quadrinhos ou histórico do Comicle para satisfazer a estrutura.

## Verificação

- [ ] Executar instalação reproduzível, build, lint, tipagem e os oito testes de conteúdo existentes.
- [ ] Verificar o comportamento real do endpoint mínimo de saúde e o carregamento da web; evitar testes que apenas repetem configuração.

## Cuidados de implementação

Reaproveitar padrões de configuração do Comicle seletivamente. Cada pacote recebe apenas as dependências usadas; a raiz permanece privada como pacote.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
