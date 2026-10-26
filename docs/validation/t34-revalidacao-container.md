# T34 — Revalidação do container

Data: 26/10/2026. Revalidação local da aplicação após a integração das políticas D02–D06/D09 e a publicação editorial de 348 perguntas. A tarefa conserva seu status no [índice](../tasks/README.md).

## Artefato verificado

- Imagem local: `penshow:t34-20261026`.
- ID retornado por `docker image inspect`: `sha256:5126dd52af634bfc807b72443ed1e4cc4f8dba8fb21d4a092f34ff5d97629b9d`.
- Catálogo: 348 aprovadas, hash `246b223566b0f800cbb5ad1b63bf605a7844193a0de73a6bf2061c70c8ec088f`.
- Narrações: 348 entradas, com correspondência de IDs/textos e hashes dos WAVs conferidos.
- Runtime: usuário sem root, 50 PNGs, atribuições/licenças e dependências de execução; sem fontes/testes próprios, ferramentas de desenvolvimento, candidatas, revisões, lotes ou baselines editoriais.

A imagem foi construída da árvore local de trabalho, que contém alterações ainda não commitadas. O ID da imagem identifica o artefato testado; não foi atribuído um novo commit nem publicada uma tag remota.

## Mudanças na verificação

`scripts/smoke-container.mjs` agora compara o hash do catálogo interno da imagem com o da publicação local. Uma imagem antiga que inicia e responde ao healthcheck não passa se contiver outro catálogo. A execução contra `penshow:narrator` foi recusada pela mensagem de divergência esperada, confirmando esse caso negativo.

O roteiro verifica todas as narrações: quantidade, unicidade dos IDs, hash do enunciado e hash dos bytes do WAV. Também inspeciona os diretórios privados permitidos no runtime e testa 404 para URLs de lotes, revisões, baseline e manifesto de fontes.

## Execuções

| Verificação | Resultado |
|---|---|
| `docker build --tag penshow:t34-20261026 .` | Aprovado, com validação de publicação/artes e build dentro do builder |
| `pnpm test:container penshow:t34-20261026` | Aprovado |
| Teste negativo com `penshow:narrator` | Recusado por divergência de hash, como esperado |
| `docker compose --env-file infra/production.env.example config --quiet` | Aprovado |
| Execução do serviço Compose com a imagem atual, projeto isolado e porta aleatória em loopback | `healthy`, `/api/health` e `/penshow/` aprovados; container/rede de teste removidos |
| `pnpm test` | 905 aprovados: 43 conteúdo, cinco artes, 193 shared, 482 servidor e 182 web |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` | Aprovados |
| `git diff --check` | Aprovado |

O smoke verificou HTTP/cache, caminhos de recarga, privacidade, CORS, sessões, WebSocket e polling autenticados, healthcheck Docker e encerramento com código 0 mesmo com upload incompleto e WebSocket sem confirmação de fechamento. O reinício invalidou as sessões anteriores e iniciou sem salas, conforme a operação em memória. Configuração inválida, base incompatível e catálogo corrompido/ausente encerraram com código 1.

Na mesma imagem, `NODE_ENV=test` e porta somente em loopback permitiram o quiz curto com duas identidades, seis perguntas narradas, pontuação conferida a partir das revelações e retorno ao lobby. Não foram adicionadas rotas de teste, gabarito antecipado ou alterações de tempo ao produto.

## Limites

O smoke da imagem cobre o quiz curto, não o percurso completo de cinco fases e combate; essas regressões permanecem nas suítes T29/T39. Em produção, iniciar partida continua recusado. O teste local não representa aceites humanos, acesso externo ou publicação na VM.

A CI hospedada não foi executada nesta revalidação; o job `container` já chama o roteiro atualizado. A T35 continua por último, após VM/destino e atendimento das dependências, incluindo os aceites de T30–T32 e as 5.000 perguntas da T33.
