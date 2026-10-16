# T05 — Web base, interface e navegação

- **Depende de:** [T02](./T02-contratos-e-documentacao.md)
- **Pacotes:** web
- **Marco:** M1
- **Branch sugerido:** `task/05-web-base-e-interface`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Preparar navegação, componentes e stores com a mesma separação de responsabilidades do Comicle.

## Leia antes

- [arquitetura.md](../arquitetura.md)
- [plano-do-jogo.md](../plano-do-jogo.md)

## Decisões em consulta

D07 orienta a identidade visual definitiva; componentes funcionais podem usar estilos provisórios claramente identificados.

## Entregáveis

- [ ] Criar rotas de início, perfil, sala e erro, com suporte a caminho base configurável.
- [ ] Preparar stores de sessão, perfil e sala, cliente HTTP/socket e armazenamento local seguro.
- [ ] Centralizar textos em `strings/pt-BR.ts`; criar Button, Dialog, Timer, PlayerChip e aviso de conexão com semântica acessível.
- [ ] Criar `docs/interface.md` com tokens, navegação, estados de carregamento, erro e ausência de dados.

## Critérios de aceite

- [ ] Componentes enviam intenções pelas stores e não abrem conexões diretamente.
- [ ] Bloqueio de localStorage ou falha de rede não produz tela em branco.
- [ ] Cronômetro e cores não são os únicos meios de entender estado e ações.
- [ ] Rotas e chaves locais usam namespace do PENSHOW.

## Verificação

- [ ] Testar navegação inválida, leitura de armazenamento corrompido e recuperação de erro.
- [ ] Testar foco do diálogo, acionamento por teclado e estados offline nas ações.

## Cuidados de implementação

Reutilizar componentes úteis do Comicle; não portar telas de desenho ou quadrinhos. O tratamento dos contratos deve evoluir junto das tarefas de jogo.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
