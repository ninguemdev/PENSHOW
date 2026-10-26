# T40 — Posição e tamanho das peças do personagem

Dependências: T06, T08 e T39. [Planejamento e futura adoção no Comicle](../plano-editor-personagens.md).

## Entregas

- [x] Contrato versionado de posição/escala, limites compartilhados e validação estrita na rede.
- [x] Leitura de perfis legados e recuperação local por peça.
- [x] Cabeça sem seleção ou transformação; preservação dos formatos legados.
- [x] Cabelo opcional e procedência da nova arte, mantendo as 50 artes do Comicle intactas.
- [x] Editor com arraste, controles de teclado/toque, restauração e persistência.
- [x] Mesma geometria no DOM e Canvas, sem modificar hitbox ou regras da partida.
- [x] Documentação da unidade portável e roteiro para implementação futura no Comicle.
- [x] Verificações finais e evidências registradas no planejamento: 935 testes, qualidade, desktop/celular com Axe, arena e smoke Docker aprovados.

## Aceite

Modificar uma peça sem mover a cabeça ou outras peças; salvar e recarregar; confirmar a mesma composição para outro jogador no lobby e após reconectar. Recusar ajustes ilegais, inclusive transformações da cabeça. Não alterar repositório ou implantação do Comicle.
