# T06 — Perfil, nomes e editor de personagens

- **Depende de:** [T05](./T05-web-base-e-interface.md)
- **Pacotes:** web, shared, assets
- **Marco:** M1
- **Branch sugerido:** `task/06-perfil-e-avatares`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Reaproveitar o sistema de nome e personagem do Comicle com identidade e armazenamento próprios.

## Leia antes

- [analise-comicle.md](../analise-comicle.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [ ] Migrar catálogo, regras de seleção/sanitização, artes necessárias, editor e renderizador em camadas.
- [ ] Implementar perfil com apelido normalizado, validação compartilhada e retorno ao fluxo de entrada após salvar.
- [ ] Persistir em `penshow.profile`; recuperar partes válidas quando o catálogo mudar.
- [ ] Adaptar o verificador de artes e manter licença e procedência dos arquivos efetivamente reutilizados.

## Critérios de aceite

- [ ] Primeira visita permite montar ou sortear o personagem e salvar um nome válido.
- [ ] Avatar permanece após recarregar; opções inválidas são saneadas sem apagar partes válidas.
- [ ] Editor funciona por teclado e toque; não há dependência de Canvas ou editor de quadrinhos.

## Verificação

- [ ] Testar nickname vazio, longo e Unicode; sorteio determinístico e sanitização de catálogo.
- [ ] Testar seleção, opção sem acessório, persistência e artes ausentes/inseguras.

## Cuidados de implementação

Preservar a identidade Git configurada e as licenças dos arquivos reutilizados. IDs de personagem são públicos; credenciais de sessão não pertencem ao perfil.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
