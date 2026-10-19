# T12 — Seleção de temas, perguntas e reserva da final

- **Depende de:** [T10](./T10-catalogo-e-publicacao-de-perguntas.md)
- **Pacotes:** server
- **Marco:** M2
- **Branch sugerido:** `task/12-selecao-de-temas-e-perguntas`

O status desta tarefa fica somente no [índice](README.md). As evidências abaixo descrevem o módulo privado implementado e as verificações executadas.

## Objetivo

Selecionar conteúdo revisado sem reposição e impedir início de uma fase sem estoque adequado.

## Leia antes

- [plano-do-jogo.md](../plano-do-jogo.md)
- [perguntas.md](../perguntas.md)
- [arquitetura.md](../arquitetura.md)

## Entregáveis

- [x] Criar seleção por tema/dificuldade com RNG injetável, histórico de IDs e deduplicação editorial.
- [x] Implementar fila de escolha de tema, até quatro opções elegíveis, prazo e continuidade da fila na revanche.
- [x] Verificar estoque para as fases e dois turnos por pessoa na dinamite; reservar perguntas da final sem permitir consumo antecipado.
- [x] Definir resposta explícita para esgotamento: outros temas elegíveis ou interrupção informada sem vencedor inventado.

## Critérios de aceite

- [x] A mesma pergunta não reaparece em outra fase da mesma partida.
- [x] Tema sem a mistura de dificuldades necessária não é oferecido como válido.
- [x] Reiniciar fase ou reconectar não sorteia outro enunciado para a pergunta atual.
- [x] Nenhuma seleção faz chamada a uma API externa durante a partida.

## Verificação

- [x] Testar reserva de 50 para a final, falta de dificuldade e conjunto com menos de quatro temas elegíveis.
- [x] Testar sorteio determinístico, não repetição, fila com mais de cinco participantes e catálogo esgotado.

## Cuidados de implementação

Usar fixtures pequenas para testes; exigência de 50 na final vale para o formato completo, não para o primeiro protótipo de uma fase. Não importar o catálogo para o cliente.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.

## Evidências de verificação — 19/10/2026

- Branch `task/12-selecao-de-temas-e-perguntas`, preservando o trabalho anterior no workspace. Implementação restrita ao servidor e documentação; nenhum contrato público, candidato, pergunta revisada ou catálogo publicado foi alterado.
- `QuestionSelection.create` recebe o repositório já carregado, portas de IDs/sorteio, participantes, temas e formato explícito. Valida e copia o catálogo uma vez; usa somente perguntas aprovadas em pt-BR, de quatro alternativas, para os orçamentos atuais. `classic-prototype` exige 3 fáceis/3 médias sem final; `full-prototype` exige as cinco fases propostas e reserva de 25 fáceis/25 médias. Os nomes indicam configuração experimental, sem confirmar D01–D06 ou executar modalidades futuras.
- `question-pool.domain.ts` deduplica enunciados normalizados e componentes transitivos declarados em `equivalentQuestionIds`, inclusive entre fontes/temas. Mantém um representante elegível por componente, antes de contar estoque; versão booleana ou tema desabilitado não elimina uma versão elegível. IDs repetidos e grupos com referências inexistentes são recusados. Equivalência por sentido continua exigindo revisão editorial explícita, sem consultas externas ou inferência automática.
- A busca de alocação verifica estoque por tema/dificuldade para todas as fases, incluindo N médias/N difíceis na dinamite. A reserva usa excedentes de uma alocação viável; ao oferecer temas, cada escolha precisa conservar a viabilidade das fases restantes. O teste compara o algoritmo à enumeração completa das oito distribuições possíveis em 150 estoques pequenos, incluindo casos viáveis e inviáveis.
- `theme-queue.domain.ts` sorteia a fila a partir de IDs ordenados, conserva pendentes/atendidos, remove ausentes e adiciona recém-chegados antes de repetir atendidos. Teste com oito pessoas exerce cinco escolhas e uma nova instância de revanche: as três pendentes escolhem antes de qualquer repetição. A fila é entregue por cópia ao dono da sala para a futura integração de ciclo de partida.
- Abertura oferece até quatro temas elegíveis e evita o anterior quando há alternativa. O prazo experimental é de dez segundos, substituível por configuração interna. Escolha exatamente no prazo é recusada; expiração sorteia entre as opções oferecidas. Callbacks antecipados, repetidos ou de fase antiga não avançam a seleção. O agendamento do callback pertence ao motor da T14.
- A alocação é sem reposição por partida. A preparação embaralha alternativas, gera UUIDs pela porta de IDs e constrói explicitamente `PublicQuestion`; gabarito, explicação e mapa editorial ficam privados. Reabrir/consultar não muda pergunta, alternativas, IDs ou prazo. Retornos são cópias independentes; escolha e avanço repetidos não consomem outra oportunidade ou pergunta. IDs inválidos/editoriais/repetidos e sorteio fora do intervalo falham antes de gravar uma preparação.
- Teste com o estoque mínimo de 78 registros sintéticos para duas pessoas consome 28 perguntas nas cinco fases e mantém as 50 da final intactas. Depois usa as 50 sem repetição e retorna interrupção terminal sem vencedor. Outro teste continua com inéditas após a reserva e interrompe quando só resta dificuldade incompatível. Com doze pessoas, o teste consome 48 antes da final, sendo 12 médias e 12 difíceis na dinamite, e conserva a reserva.
- Testes cobrem distribuição da reserva e ciclos de temas da final, recorte de temas habilitados, estoque insuficiente apesar de total alto, menos de quatro temas, estabilidade com input reordenado e RNG determinístico, cópias defensivas, privacidade da pergunta pública, mapa de gabarito, portas inválidas, contexto antigo, autorização do participante da vez e slugs coincidentes com propriedades herdadas de `Object`.
- Smoke do JavaScript compilado com diretório corrente fora do workspace: catálogo real de 72 registros, seis temas exercitados em seis instâncias clássicas, 36 perguntas distintas preparadas com quatro alternativas, mistura 3/3 e reconsulta estável. O formato completo foi recusado pelo mesmo catálogo. Smoke adicional conferiu quatro temas oferecidos, expiração, continuidade da fila em nova instância e HTTP sem IDs editoriais. `fetch` bloqueado durante a seleção registrou zero chamadas externas.
- Vite real retornou HTTP 403 para o novo módulo privado e o catálogo por `/@fs`, mantendo a página com HTTP 200. Nos 54 arquivos do bundle web não foram encontrados IDs/enunciados editoriais, hash privado ou configuração de equivalências. Os 28 JSON de candidatos e o manifesto de fontes conservaram os hashes registrados na T11. Servidores/agendadores encerrados; nenhum script temporário persistido.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm questions:validate`, `pnpm questions:check`, `pnpm build` e `git diff --check` passaram. **465 testes**: 194 server (25 novos de seleção), 159 shared, 75 web, 32 de conteúdo/publicação e cinco de artes. A CI hospedada depende do envio do branch.
- [Seleção de perguntas](../selecao-de-perguntas.md), README, arquitetura, modelo de dados, perguntas e servidor atualizados. A composição no motor, serialização na fila da sala, timers reais, comandos e projeção de partida seguem a T14 e tarefas das modalidades. A T12 não habilita o botão de início nem simula uma partida executável.
