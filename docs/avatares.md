# Perfil e personagens

Implementação de T06, derivada do Comicle no commit [`4521f34df78da7de54a30715d50e748c50aa0696`](https://github.com/ninguemdev/Comicle/tree/4521f34df78da7de54a30715d50e748c50aa0696). [Atribuição, licença MIT e arquivos reutilizados](../THIRD_PARTY_NOTICES.md). As artes são as originais desse catálogo, sem alterações visuais; o estilo da interface do PENSHOW continua provisório (D07).

## Catálogo público

`packages/shared/src/avatar/catalog.json` contém versão, categorias, IDs, rótulos em português e arquivos relativos a `apps/web/public/avatars/`. `catalog.ts` valida o JSON estritamente ao carregar. Não contém dados de identidade, credenciais, perguntas ou gabaritos.

| Ordem de camada | Categoria | Obrigatória | Opções |
|---|---|---|---|
| 1 | `head` — Cabeça | Sim | 4 |
| 2 | `cheeks` — Bochechas | Não | 6 |
| 3 | `eyes` — Olhos | Sim | 10 |
| 4 | `mouth` — Boca | Sim | 10 |
| 5 | `faceAccessory` — Acessório | Não | 10 |
| 6 | `hat` — Chapéu | Não | 10 |

São 50 peças, mais a opção `Nenhum` (`null`) nas três categorias opcionais. Cada categoria armazena uma única peça. IDs são únicos globalmente, em kebab-case, com prefixo da categoria (`face-accessory` para `faceAccessory`). O arquivo tem o caminho exato `<categoria>/<id>.png`, sem URL, travessia de diretório ou SVG.

O padrão é a primeira opção ativa de cada categoria obrigatória e `null` nas opcionais. `randomAvatar(rng)` recebe `AvatarRandom.integer(maxExclusive)`; seleciona apenas opções ativas, incluindo ausência de acessórios. O RNG de aparência do navegador não decide resultado de jogo. Testes usam índices determinísticos.

`avatarSchema` exige IDs da própria categoria, inclusive em comandos recebidos pelo servidor. ID desconhecido, peça de outra categoria, campo extra ou `null` em categoria obrigatória são recusados. Para aposentadoria, adicione `retired: true`: a opção deixa o editor/sorteio, mas continua válida para perfis já salvos e renderização. Não remova a arte aposentada nem reutilize um ID publicado.

## Perfil, persistência e retorno

Na primeira visita, a store disponibiliza apelido vazio e personagem sorteado, sem gravar o rascunho. As ações de nome, seleção, sorteio e salvamento passam por `profile-store`; componentes não abrem conexão nem persistem diretamente.

O nome é validado por `nicknameSchema`: NFC, trim e espaços consecutivos normalizados; de 1 a 20 pontos de código Unicode depois da normalização; controles e caracteres de formatação invisíveis são recusados. O limite bruto de 256 unidades evita entradas excessivas. Acentos e emojis simples são aceitos; o limite não é de grafemas, e sequências com caracteres de formatação, como ZWJ, são recusadas pelo contrato existente.

Salvar valida todo o perfil, grava somente `{ nickname, avatar }` em `penshow.profile` e retorna ao início. A tela inicial exibe nome/personagem e oferece editar. `perfil?next=<caminho dentro do base>` pode retornar à criação ou a uma sala válida depois de salvar; outros destinos caem no início. Não permite redirecionamento externo nem entrada automática em uma sala. O fluxo de T09 conserva o convite durante a preparação e permite aplicar um perfil salvo diferente ao lobby por ação explícita.

A leitura local usa validação tolerante apenas para avatar: com nome válido, `sanitizeAvatar` preserva cada peça ainda existente e substitui somente as inválidas/ausentes pelos padrões. Peças opcionais inválidas viram `null`. A store avisa sobre recuperação e tenta regravar o perfil saneado. Isso não relaxa o protocolo da rede. JSON ou nome inválidos são descartados; dados de sessão não integram o perfil.

Getter de storage bloqueado e quota não interrompem a edição. O perfil permanece em memória e a confirmação diz **Perfil disponível nesta aba**, junto do aviso de armazenamento. Recarregar nesse caso não promete persistência. Apagar exige confirmação; remove apenas `penshow.profile`, mantendo a sessão separada.

## Editor e renderização

`AvatarEditor` apresenta seis abas, com foco móvel por setas esquerda/direita, Home/End e um único tab stop ativo. Opções são botões nativos com `aria-pressed`; Enter, Espaço e toque selecionam peças. O botão Sortear preserva o nome. As três categorias opcionais oferecem Nenhum. Rótulos de catálogo são texto, sem HTML injetado.

`AvatarRenderer` compõe imagens absolutas dentro de uma área quadrada, com a ordem da tabela, sem Canvas. Imagens têm `alt=""`; o contêiner recebe nome acessível quando necessário e é decorativo nas miniaturas. Os tamanhos previstos são 32, 64, 160 e 256px, limitados ao espaço disponível no celular. `avatar-layers.ts` resolve arquivos somente por IDs do catálogo e respeita `BASE_URL`; não transforma um ID recebido em caminho de arquivo. O `PlayerChip` usa o mesmo renderizador.

## Artes e verificação

As 50 artes PNG de 1024 × 1024 preservam o enquadramento e a transparência do Comicle. Bochechas ficam sob olhos/boca; acessórios e chapéus sobrepõem o rosto conforme a ordem. Não foram copiados gabaritos, gerador, editor de desenho ou dependências de Canvas.

```sh
pnpm avatars:check
pnpm test:assets
```

O primeiro compila shared e verifica catálogo versus arquivos: ausência, órfãos, duplicatas, caminho e tipo; não segue links simbólicos. PNGs têm limite de 100 KB, dimensões fixas, CRC de todos os chunks, sequência estrutural e dados descomprimidos limitados ao tamanho esperado. São aceitos PNGs não entrelaçados de paleta 4/8 bits ou RGBA 8 bits, com pixels visíveis e transparentes. Filtros são reconstruídos para conferir transparência real; apenas chunks de imagem e metadados fixos (`sRGB`, `gAMA`, `cHRM`, `pHYs`) são aceitos. SVG, scripts disfarçados, animação e conteúdo após IEND são recusados. Suporte a outro formato exige evolução explícita do catálogo e do verificador.

Os testes de artes também conferem o manifesto SHA-256 de [procedência](../licenses/comicle-avatars.json) e a cópia da licença distribuída na web. Novas artes devem registrar licença/origem própria; mudanças nas artes migradas exigem atualização da procedência, sem atribuí-las ao commit original como cópias intactas. A licença MIT pode ser consultada no rodapé da aplicação, incluindo builds sob caminho base.

`pnpm test` inclui testes de artes, contratos, UI e persistência. `pnpm avatars:check` também roda na CI. Após alterar uma peça, confira composição em 32/64/160/256px e teclado/toque no editor; uma verificação de arquivo não substitui inspeção visual do alinhamento.
