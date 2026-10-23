# T38 — Efeitos sonoros simples e fluidos

- **Depende de:** base de som de T31 e narrador de T37
- **Marco:** M5
- **Branch:** `feat/efeitos-sonoros-fluidos`

Solicitada em 23/10/2026: gerar sons simples para botões, mudança de fase, perguntas e demais eventos do jogo. O status fica no [índice](README.md); catálogo, controles e geração da prévia estão em [sons](../sons.md).

## Entregáveis e aceite

- [x] Catálogo de 16 efeitos sintetizados localmente, com notas curtas e envelopes suaves; explosão suavizada.
- [x] Cliques reais de mouse, toque e teclado e navegação, respeitando controles desabilitados e silêncio.
- [x] Sinais de pergunta, abertura das respostas, confirmação de envio, escolhas, lobby e resultados, mantendo os avisos de fase e desfechos.
- [x] Cliques sem cortar os resultados da partida, limite de repetição rápida e transições com fade.
- [x] Redução automática dos efeitos durante a narração, sem alterar preferências salvas ou o volume próprio do robô.
- [x] Gerar WAV combinado e arquivos individuais para escuta, sem dependência de serviços externos ou downloads no jogo.
- [x] Concluir verificações de tipos, qualidade, testes e build.

## Evidências

- Formatação, lint, tipos e build aprovados. Suíte geral: 43 conteúdo, cinco artes, 186 shared, 455 server e 176 web, totalizando 865 testes aprovados.
- Dez cenários de som/narrador aprovados em desktop/celular, sem retry (2,3 minutos). Incluem cliques reais de ponteiro/teclado, navegação, controles desabilitados, silêncio, partida até o pódio, reconexão sem repetir explosão e jogo sem Web Audio.
- Renderização nativa dos 16 efeitos aprovada nos dois projetos. Prévia combinada de 16,8 segundos e WAVs individuais em `data/audio-previews/`; pico máximo de 0,1102, sem saturação, término individual em até 0,675 s e caudas silenciosas. Limite de variação por amostra verificado.
- Teste adicional de substituição durante playback aprovado nos dois projetos (8,3 s): cancela notas futuras, faz fade da nota atual e encerra o novo aviso antes de 0,34 s. Cliques rápidos criam uma única fonte e preservam a cauda da vitória.
- Redução dos efeitos durante a voz coberta na integração dos stores; browser confere narração e efeitos reais mantendo o slider em 55%. Preferência não é sobrescrita pela atenuação.
- A nova cobertura encontrou a supressão da saída quando o lobby voltava ao conjunto inicial de membros. Correção permite entradas/saídas sucessivas e mantém mudanças de presença silenciosas. A asserção de reconexão compara explosões, pois o novo aviso de pergunta pode tocar legitimamente durante o percurso.

As medições automáticas não equivalem a escuta humana; a prévia permite avaliar timbre e conforto no aparelho do jogador. As pendências históricas de T31 e T35 continuam registradas nas respectivas tarefas. Nenhum deploy externo nesta tarefa.
