# Planejamento — posição e tamanho das peças do personagem

Pedido de 26/10/2026: permitir ajustar posição e tamanho de todas as peças, mantendo formato, posição e tamanho da cabeça fixos. Implementação no PENSHOW; adoção no Comicle em uma entrega futura.

## Comportamento previsto

- Cabeça sem aba de seleção e sem controles de transformação. Novos personagens usam a cabeça redonda; formatos legados permanecem fixos no perfil existente, inclusive ao sortear as outras peças.
- Olhos, boca, bochechas, acessórios, cabelo e chapéu possuem posição horizontal/vertical e escala uniforme independentes. Olhos e bochechas continuam sendo uma peça por categoria, conforme as artes existentes.
- Selecionar uma peça, arrastar a prévia por mouse/toque ou usar controles nativos de posição e tamanho por teclado. Escala preserva proporções; não há rotação, espelhamento ou deformação.
- Posição limitada a ±35% do quadro em cada eixo e escala de 50% a 200%. Valores iniciais são decisões de implementação ajustáveis após avaliação de uso.
- A escala usa o centro dos pixels visíveis de cada arte como pivô. A composição é recortada pelo quadro do personagem, igualmente em miniaturas e na arena.
- Remover/trocar uma peça restaura seus ajustes. Um botão restaura somente a peça ativa. Sortear restaura todos os ajustes e conserva a cabeça e o nome.
- Alterações ficam no rascunho até salvar; persistência, publicação no lobby e reconexão preservam a composição.

## Etapas e critérios de aceite

1. **Contrato compartilhado:** acrescentar cabelo opcional e `layout: { version: 1, parts: { ... } }`, com ajustes `{ x, y, scale }` em unidades proporcionais ao quadro. Campos opcionais permitem ler perfis antigos sem alteração visual. Rejeitar valores não finitos, fora dos limites, versões desconhecidas, categorias extras e qualquer transformação da cabeça na rede.
2. **Catálogo e geometria:** acrescentar uma arte inicial de cabelo, sem substituir as 50 artes existentes; registrar procedência. Calcular pivôs das artes. Centralizar geometria pura no pacote shared, sem React, DOM, Canvas, armazenamento ou transporte.
3. **Persistência:** sanear dados locais por peça, preservando escolhas e ajustes válidos; não suavizar a validação dos comandos recebidos pelo servidor.
4. **Editor:** controles rotulados, arraste com captura de ponteiro, suporte a teclado/toque, restauração por peça e indicação explícita de cabeça fixa. Ausência de peça desabilita ajustes.
5. **Renderização integrada:** usar a mesma geometria no editor, perfil, lobby, placar, pódio e Canvas do desempate. Cosméticos não alteram colisões, mira ou hitbox.
6. **Verificação:** testes de contrato, migração, persistência, controles, geometria e distribuição pela sala; percurso Playwright em desktop/celular com salvar, recarregar e segunda identidade. Rodar qualidade, testes e build; inspecionar a prévia no navegador.

## Preparação para o Comicle

A unidade portável é o domínio do avatar: tipos, constantes, schemas de layout, sanitização e cálculo de retângulos, além do catálogo/pivôs e da arte de cabelo. A UI utiliza esses contratos por meio da store do PENSHOW; não introduzir dependência do Comicle ou chaves de armazenamento compartilhadas entre os produtos.

Na futura implementação do Comicle:

1. Mapear os tipos/IDs atuais e importar o contrato `layout.version = 1`, mantendo as atribuições MIT existentes.
2. Portar validação e migração de perfis, inclusive dados persistidos no servidor, antes de habilitar a edição.
3. Revisar as projeções públicas e listas de campos permitidos: cabelo e layout precisam acompanhar o perfil no lobby, na partida e na reconexão. Aplicar os mesmos pivôs, unidades, ordem de camadas e recorte a todos os renderizadores, inclusive exportações de quadrinhos/imagens.
4. Adaptar controles e armazenamento à aplicação; repetir os testes de compatibilidade, sala e exportação.
5. Coordenar atualização de cliente e servidor: clientes antigos com schemas estritos não entendem os campos novos. O suporte a leitura de perfis antigos não equivale a compatibilidade com clientes antigos conectados.

Não há alteração no repositório, serviço ou implantação do Comicle nesta entrega. Publicar o PENSHOW também é uma etapa separada da implementação local.

## Mapa da implementação no PENSHOW

| Parte | Arquivos principais | Resultado |
|---|---|---|
| Contrato e geometria portável | `packages/shared/src/avatar/layout.ts`, `domain/avatar.ts`, `schemas/profile.ts` | Transformações versionadas, limites, validação, recuperação local e retângulos proporcionais |
| Catálogo e pivôs | `packages/shared/src/avatar/catalog.ts`, `catalog.json`, `scripts/avatars/update-pivots.mjs` | Cabelo opcional, cabeça fixa no sorteio e pivôs calculados pelos pixels visíveis |
| Rascunho e persistência | `apps/web/src/stores/profile-store.ts` | Ajustar/restaurar peças, salvar/recarregar e preservar a cabeça legada |
| Interface | `apps/web/src/features/avatar/`, `apps/web/src/styles.css` | Abas editáveis, arraste, sliders acessíveis e prévia compacta que acompanha a rolagem no celular |
| Multiplayer | `apps/server/src/modules/views/build-player-view.ts` | Projeção pública inclui cabelo e layout, sem perder ajustes na sincronização |
| Arena | `apps/web/src/features/tiebreak/tiebreak-arena.tsx` | Mesmos retângulos e recorte do DOM, sem mudança na física |
| Nova arte | `apps/web/public/avatars/hair/hair-tousled.png` | Cabelo inicial Despenteado; [prompt, ferramenta integrada e procedência](../licenses/penshow-hair.md) |

O protocolo aceita os formatos de cabeça legados para preservar perfis existentes, mas o editor não permite trocar o formato. A cabeça redonda é a opção inicial de novos personagens. Os limites e a escala uniforme foram definidos nesta implementação; ajustes de equilíbrio visual podem evoluir sem reescrever os adaptadores do DOM e do Canvas.

## Evidências

Verificações executadas em 26/10/2026:

| Verificação | Resultado |
|---|---|
| `pnpm test` | 935 aprovados: 50 conteúdo/infra, cinco artes, 207 shared, 487 servidor e 186 web |
| `pnpm lint`, `pnpm format:check`, `pnpm typecheck` | Aprovados |
| `pnpm build` | Aprovado; Vite avisa que o bundle principal está acima de 500 KB (aproximadamente 513 KB antes de gzip) |
| `node scripts/avatars/update-pivots.mjs --check` | Pivôs correspondem aos pixels visíveis; artes verificadas também no build Docker |
| `pnpm --filter @penshow/e2e exec playwright test tests/avatar-editor.spec.ts` | Desktop e celular emulado aprovados: arraste real por mouse/toque, sliders, cabeça fixa, salvar/recarregar, segunda identidade e reconexão |
| Acessibilidade do editor | Axe sem violações nos dois projetos; teclado, ausência de overflow horizontal e limites da prévia verificados |
| `pnpm --filter @penshow/e2e exec playwright test tests/avatar-editor.spec.ts tests/tiebreak.spec.ts` | Quatro percursos aprovados, incluindo tiro, perguntas de sobrevivência, reconexão e pódio; após o refinamento responsivo, o editor foi verificado novamente nos dois projetos |
| Inspeção visual | Capturas desktop/celular revisadas; corrigido o transbordamento da imagem na prévia compacta e acrescentada uma asserção dos limites do quadro |
| Documentação | 106 links locais conferidos e `git diff --check` aprovado |
| Docker | `docker build --tag penshow:avatar-editor .` e `pnpm test:container penshow:avatar-editor` aprovados; 51 artes, licença MIT, catálogo e narrações presentes, parada/reinício e partida de seis perguntas em produção verificados |

Capturas locais da última execução: `e2e/test-results/avatar-editor-personagem-a-b7a94-ência-e-composição-no-lobby-desktop/editor.png`, `e2e/test-results/avatar-editor-personagem-a-b7a94-ência-e-composição-no-lobby-mobile/editor.png` e `editor-viewport.png` no diretório mobile. Relatórios e capturas ficam fora do Git, conforme as regras existentes.

O teste em rede detectou uma lista de campos públicos que descartava os novos ajustes; a projeção foi corrigida e passou a ser coberta por regressão de atualização/reconexão. Nenhum teste substitui a avaliação de conforto por usuários ou a revisão em aparelhos físicos. Esta entrega foi implementada e validada localmente; a publicação no piloto é uma etapa posterior.

Uma execução do smoke Docker em paralelo com as suítes terminou com código 137 no teste de parada. A repetição isolada passou integralmente, sem alterar o encerramento do servidor ou relaxar o teste; a causa da ocorrência inicial não foi determinada. Os containers temporários dessa verificação foram removidos.
