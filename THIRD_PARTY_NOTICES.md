# Código e artes de terceiros

## Comicle

Origem: [ninguemdev/Comicle](https://github.com/ninguemdev/Comicle), commit [`4521f34df78da7de54a30715d50e748c50aa0696`](https://github.com/ninguemdev/Comicle/tree/4521f34df78da7de54a30715d50e748c50aa0696).

Copyright (c) 2026 Dionel Sebastião de Morais. Licença MIT preservada integralmente em [licenses/comicle-LICENSE.txt](licenses/comicle-LICENSE.txt) e distribuída com a web em `public/licenses/comicle-LICENSE.txt`.

Reutilização nesta migração:

- `packages/shared/src/avatar/catalog.json` e as 50 artes PNG referenciadas, copiadas sem alteração visual de `apps/web/public/avatars/`.
- `packages/shared/src/domain/avatar.ts` e `avatar/catalog.ts`, adaptados para imports ESM, RNG injetado e validação mais estrita do catálogo.
- Editor, renderizador/camadas, recuperação de perfil e verificador de artes derivados das implementações de `apps/web/src/features/avatar/`, `stores/profile-store.ts`, `features/profile/next-path.ts` e `apps/web/scripts/avatars/{check,png}.ts`. Foram adaptados à UI, stores, regras e ferramentas do PENSHOW.
- Agregado/fila, geração de códigos, política de anfitrião e ciclo de salas em `apps/server/src/modules/rooms/{room,room-code,host-policy,room.service}.ts`, derivados dos módulos homônimos do Comicle. O PENSHOW usa seu PlayerId autenticado, contratos de quiz e agendador próprio, sem guestId duplicado, banco, StoryRepository ou Match de quadrinhos.

O manifesto [licenses/comicle-avatars.json](licenses/comicle-avatars.json) registra origem, commit, caminhos e SHA-256 dos arquivos PNG efetivamente copiados. Não foram migrados templates, gerador, Canvas, paleta/editor de desenho nem módulos de histórias. Alterações futuras devem manter a atribuição e registrar a origem de novas artes.
