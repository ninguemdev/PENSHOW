# T12 — Seleção de temas, perguntas e reserva da final

- **Depende de:** [T10](./T10-catalogo-e-publicacao-de-perguntas.md)
- **Pacotes:** server
- **Marco:** M2
- **Branch sugerido:** `task/12-selecao-de-temas-e-perguntas`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Selecionar conteúdo revisado sem reposição e impedir início de uma fase sem estoque adequado.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [perguntas.md](../perguntas.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [ ] Criar seleção por tema/dificuldade com RNG injetável, histórico de IDs e deduplicação editorial.
- [ ] Implementar fila de escolha de tema, até quatro opções elegíveis, prazo e continuidade da fila na revanche.
- [ ] Verificar estoque para as fases e dois turnos por pessoa na dinamite; reservar perguntas da final sem permitir consumo antecipado.
- [ ] Definir resposta explícita para esgotamento: outros temas elegíveis ou interrupção informada sem vencedor inventado.

## Critérios de aceite

- [ ] A mesma pergunta não reaparece em outra fase da mesma partida.
- [ ] Tema sem a mistura de dificuldades necessária não é oferecido como válido.
- [ ] Reiniciar fase ou reconectar não sorteia outro enunciado para a pergunta atual.
- [ ] Nenhuma seleção faz chamada a uma API externa durante a partida.

## Verificação

- [ ] Testar reserva de 50 para a final, falta de dificuldade e conjunto com menos de quatro temas elegíveis.
- [ ] Testar sorteio determinístico, não repetição, fila com mais de cinco participantes e catálogo esgotado.

## Cuidados de implementação

Usar fixtures pequenas para testes; exigência de 50 na final vale para o formato completo, não para o primeiro protótipo de uma fase. Não importar o catálogo para o cliente.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
