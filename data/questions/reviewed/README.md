# Registros em revisão editorial

Copie os registros escolhidos de `../candidates/<fonte>/<tema>.json` para listas JSON neste diretório, preservando `id` e `source`. Os importadores não escrevem aqui. Corrija enunciado, alternativas, gabarito, categoria e dificuldade conforme a revisão factual. Não modifique os candidatos importados para publicar uma correção.

Somente `status: "approved"`, `locale: "pt-BR"`, dificuldade `easy`/`medium`/`hard` e revisão completa podem ser publicados. A revisão precisa de `referenceUrl` HTTP(S), `reviewedAt` como data real `AAAA-MM-DD` e `checks: { "factual": true, "language": true, "uniqueAnswer": true }`, preenchidos depois de conferir os fatos, a tradução e a resposta única. Esses campos registram uma decisão editorial; o programa não comprova a verdade do conteúdo. Os demais status ficam fora do catálogo.

Use `pnpm questions:publish` e confira `../../publication-reports/questions.json`; `pnpm questions:check` verifica que catálogo e relatório correspondem às entradas sem modificá-los. Publicação inválida não substitui o último catálogo válido. IDs/enunciados aprovados duplicados exigem resolução editorial, sem escolher um vencedor automaticamente.

O primeiro lote da T11 contém 72 perguntas aprovadas, distribuídas nos seis arquivos de tema: 12 por arquivo, sendo seis fáceis, quatro médias e duas difíceis. Revisão em 17/10/2026, com referência factual por registro. Consulte o [relatório editorial](../../../docs/revisao-editorial-t11.md) e as [decisões individuais](../../publication-reports/t11-editorial.json). Candidatos e procedência originais foram preservados; as dificuldades ainda não foram calibradas com jogadores.
