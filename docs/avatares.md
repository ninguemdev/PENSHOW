# Perfil e personagens

Implementação de T06, ampliada pela [T40](tasks/T40-editor-personagens-transformacoes.md). A base deriva do Comicle no commit [`4521f34df78da7de54a30715d50e748c50aa0696`](https://github.com/ninguemdev/Comicle/tree/4521f34df78da7de54a30715d50e748c50aa0696). As 50 artes migradas permanecem intactas; foi acrescentada uma peça de cabelo própria do PENSHOW. [Atribuição e procedência](../THIRD_PARTY_NOTICES.md). O [planejamento](plano-editor-personagens.md) inclui a futura adaptação ao Comicle.

## Catálogo público

`packages/shared/src/avatar/catalog.json` contém versão, categorias, IDs, rótulos em português e arquivos relativos a `apps/web/public/avatars/`. `catalog.ts` valida o JSON estritamente ao carregar. Não contém dados de identidade, credenciais, perguntas ou gabaritos.

| Ordem de camada | Categoria | Obrigatória | Opções |
|---|---|---|---|
| 1 | `head` — Cabeça | Sim | 4 |
| 2 | `cheeks` — Bochechas | Não | 6 |
| 3 | `eyes` — Olhos | Sim | 10 |
| 4 | `mouth` — Boca | Sim | 10 |
| 5 | `faceAccessory` — Acessório | Não | 10 |
| 6 | `hair` — Cabelo | Não | 1 |
| 7 | `hat` — Chapéu | Não | 10 |

São 51 peças, mais a opção `Nenhum` (`null`) nas quatro categorias opcionais. Os quatro formatos de cabeça permanecem no catálogo para ler perfis antigos, mas não são oferecidos no editor. Cada categoria armazena uma única peça; pares de olhos/bochechas são movidos e redimensionados juntos. IDs são únicos globalmente, em kebab-case, com prefixo da categoria (`face-accessory` para `faceAccessory`). O arquivo tem o caminho exato `<categoria>/<id>.png`, sem URL, travessia de diretório ou SVG.

O padrão é a primeira opção ativa de cada categoria obrigatória e `null` nas opcionais. Novos personagens usam a cabeça redonda. `randomAvatar(rng)` recebe `AvatarRandom.integer(maxExclusive)`; sorteia as demais categorias entre opções ativas, incluindo ausência de acessórios. O sorteio do editor preserva a cabeça do perfil em edição. O RNG de aparência do navegador não decide resultado de jogo. Testes usam índices determinísticos.

`avatarSchema` exige IDs da própria categoria, inclusive em comandos recebidos pelo servidor. ID desconhecido, peça de outra categoria, campo extra ou `null` em categoria obrigatória são recusados. Para aposentadoria, adicione `retired: true`: a opção deixa o editor/sorteio, mas continua válida para perfis já salvos e renderização. Não remova a arte aposentada nem reutilize um ID publicado.

## Perfil, persistência e retorno

Na primeira visita, a store disponibiliza apelido vazio e personagem sorteado, sem gravar o rascunho. As ações de nome, seleção, sorteio e salvamento passam por `profile-store`; componentes não abrem conexão nem persistem diretamente.

O nome é validado por `nicknameSchema`: NFC, trim e espaços consecutivos normalizados; de 1 a 20 pontos de código Unicode depois da normalização; controles e caracteres de formatação invisíveis são recusados. O limite bruto de 256 unidades evita entradas excessivas. Acentos e emojis simples são aceitos; o limite não é de grafemas, e sequências com caracteres de formatação, como ZWJ, são recusadas pelo contrato existente.

Salvar valida todo o perfil, grava somente `{ nickname, avatar }` em `penshow.profile` e retorna ao início. A tela inicial exibe nome/personagem e oferece editar. `perfil?next=<caminho dentro do base>` pode retornar à criação ou a uma sala válida depois de salvar; outros destinos caem no início. Não permite redirecionamento externo nem entrada automática em uma sala. O fluxo de T09 conserva o convite durante a preparação e permite aplicar um perfil salvo diferente ao lobby por ação explícita.

A leitura local usa validação tolerante apenas para avatar: com nome válido, `sanitizeAvatar` preserva cada peça ainda existente e substitui somente as inválidas/ausentes pelos padrões. Peças opcionais inválidas viram `null`. A store avisa sobre recuperação e tenta regravar o perfil saneado. Isso não relaxa o protocolo da rede. JSON ou nome inválidos são descartados; dados de sessão não integram o perfil.

Getter de storage bloqueado e quota não interrompem a edição. O perfil permanece em memória e a confirmação diz **Perfil disponível nesta aba**, junto do aviso de armazenamento. Recarregar nesse caso não promete persistência. Apagar exige confirmação; remove apenas `penshow.profile`, mantendo a sessão separada.

## Editor e renderização

`AvatarEditor` apresenta seis abas editáveis: olhos, boca, bochechas, acessório, cabelo e chapéu, com foco móvel por setas esquerda/direita, Home/End e um único tab stop ativo. A cabeça não possui seletor nem ajustes. Opções são botões nativos com `aria-pressed`; Enter, Espaço e toque selecionam peças. O botão Sortear preserva nome/cabeça e restaura os ajustes. As quatro categorias opcionais oferecem Nenhum. Rótulos de catálogo são texto, sem HTML injetado.

A peça ativa pode ser arrastada na prévia por mouse/toque. Os sliders nativos permitem mover horizontal/verticalmente e redimensionar por teclado, com indicação em porcentagem. A posição varia de -35% a +35% do quadro e o tamanho de 50% a 200%, sempre proporcional. Em telas estreitas, a prévia fica compacta e acompanha a rolagem dentro do editor para permitir observar os ajustes. Sem peça selecionada, os ajustes ficam desabilitados. Trocar/remover a peça ou clicar em Restaurar peça remove apenas seus ajustes; salvar mantém todas as transformações no perfil.

`AvatarRenderer` compõe imagens absolutas dentro de uma área quadrada, com a ordem da tabela e recorte no limite do quadro. Imagens têm `alt=""`; o contêiner recebe nome acessível quando necessário e é decorativo nas miniaturas. Os tamanhos previstos são 32, 64, 160 e 256px, limitados ao espaço disponível no celular. `avatar-layers.ts` resolve arquivos somente por IDs do catálogo e respeita `BASE_URL`; não transforma um ID recebido em caminho de arquivo. O `PlayerChip` usa o mesmo renderizador. O Canvas da arena usa os mesmos retângulos proporcionais e o mesmo recorte; cosméticos não modificam a colisão.

## Contrato de composição e compatibilidade

`AvatarConfig` mantém os IDs existentes e acrescenta `hair?: string | null` e `layout?: { version: 1, parts: { eyes?, mouth?, cheeks?, faceAccessory?, hair?, hat? } }`. Cada ajuste é `{ x, y, scale }`: x/y são frações do quadro, com zero no posicionamento original; scale é um multiplicador uniforme. Ausência de layout ou de uma categoria significa `{ x: 0, y: 0, scale: 1 }`. Assim, perfis antigos conservam sua composição.

O catálogo registra `pivot: { x, y }`, centro do retângulo dos pixels visíveis da arte, em unidades do quadro. `node scripts/avatars/update-pivots.mjs` recalcula esses metadados; `--check` confere sem escrever. `avatarLayerRect` calcula `left = x + pivot.x * (1 - scale)`, a mesma expressão para top, e largura/altura iguais a scale. DOM e Canvas multiplicam o resultado pelo tamanho do quadro. A cabeça sempre recebe a transformação identidade.

Schemas estritos compartilhados validam limites, valores finitos, versão e categorias em cada perfil recebido. `head` dentro de `layout.parts` é recusado. A recuperação de armazenamento local descarta apenas ajustes inválidos e preserva os demais; versões desconhecidas do layout retornam à composição original. Clientes e servidor precisam ser atualizados em conjunto, pois clientes antigos podem recusar os campos novos.

Os módulos de domínio/geometria não dependem de React, armazenamento ou rede. O roteiro de portabilidade para perfis, salas e exportação de quadrinhos do Comicle está no [planejamento](plano-editor-personagens.md).

## Artes e verificação

As 50 artes PNG de 1024 × 1024 preservam o enquadramento e a transparência do Comicle. Bochechas ficam sob olhos/boca; acessórios e chapéus sobrepõem o rosto conforme a ordem. Não foram copiados gabaritos, gerador, editor de desenho ou dependências de Canvas.

```sh
pnpm avatars:check
pnpm test:assets
```

O primeiro compila shared e verifica catálogo versus arquivos: ausência, órfãos, duplicatas, caminho e tipo; não segue links simbólicos. PNGs têm limite de 100 KB, dimensões fixas, CRC de todos os chunks, sequência estrutural e dados descomprimidos limitados ao tamanho esperado. São aceitos PNGs não entrelaçados de paleta 4/8 bits ou RGBA 8 bits, com pixels visíveis e transparentes. Filtros são reconstruídos para conferir transparência real; apenas chunks de imagem e metadados fixos (`sRGB`, `gAMA`, `cHRM`, `pHYs`) são aceitos. SVG, scripts disfarçados, animação e conteúdo após IEND são recusados. Suporte a outro formato exige evolução explícita do catálogo e do verificador.

Os testes de artes também conferem o manifesto SHA-256 de [procedência](../licenses/comicle-avatars.json) e a cópia da licença distribuída na web. Novas artes devem registrar licença/origem própria; mudanças nas artes migradas exigem atualização da procedência, sem atribuí-las ao commit original como cópias intactas. A licença MIT pode ser consultada no rodapé da aplicação, incluindo builds sob caminho base.

`pnpm test` inclui testes de artes, contratos, UI e persistência. `pnpm avatars:check` também roda na CI. Após alterar uma peça, confira composição em 32/64/160/256px e teclado/toque no editor; uma verificação de arquivo não substitui inspeção visual do alinhamento.
