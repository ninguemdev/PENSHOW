# Pódio, histórico e revanche

A T25 conclui a apresentação do protótipo de partida: quiz isolado, final de vidas, pódio e nova partida na mesma sala. A sequência completa das cinco modalidades e as decisões de regras ainda pendentes não são consolidadas por esta entrega.

## Resultado e histórico

O servidor deriva `podium.standings` do único sobrevivente, seguido da ordem inversa das eliminações. A web apresenta exatamente essa ordem, com nome/personagem, posição inicial, vidas iniciais e condição final. Um participante que entrou em quarto pode ser o campeão, mesmo com menos pontos. Uma interrupção conserva seu motivo e não publica um pódio fictício.

O placar anterior fica identificado como **Placar antes da final**. `roundSummaries` contém somente resultados agregados das fases de pontuação disputadas: contexto público da fase, quantidade de perguntas resolvidas, saldo anterior/posterior, variação e acertos por participante. O servidor deriva os dados dos registros de pontuação já liquidados; a web apenas os apresenta. Os contratos conferem continuidade dos saldos, participantes únicos, deltas e correspondência ao placar final.

Esses resumos aparecem em `prototype-complete`, `podium` ou `interrupted`; não são enviados durante a disputa. Uma fase interrompida conserva os resultados já confirmados. O resumo não inclui respostas individuais, recibos de chegada, IDs editoriais, fontes, apostas privadas, seleção de conteúdo ou ordem futura de escolha dos temas. A final é explicada pelo pódio, pelas vidas e pela ordem de eliminação, sem transformar vidas em pontos.

## Preparar revanche

Somente o anfitrião recebe **Preparar revanche** no pódio. A ação envia o comando existente `match:returnToLobby` com sala e partida; o serviço revalida identidade, contexto, anfitrião e encerramento na fila da sala. O cliente aguarda a nova projeção, sem apagar a partida por conta própria.

Ao voltar ao lobby:

- Sala, código/convite, preferências e perfis permanecem.
- O agregado anterior sai da sala, descartando pontuação, vidas, histórico privado, perguntas usadas e ações consumidas. O timer da partida é cancelado.
- Quem saiu explicitamente durante a partida libera a vaga e a associação no registro. Se voltou antes do retorno ao lobby, sua presença é restaurada. Uma queda de conexão continua seguindo a carência de remoção já existente.
- Eliminados presentes continuam na lista de jogadores. Espectadores presentes são promovidos até a capacidade configurada; o anfitrião pode ajustar as vagas no lobby.
- A web limpa tentativas, confirmações e erros quando recebe o lobby ou outra partida, inclusive após descartar uma visão ao navegar. Uma confirmação atrasada da partida anterior não repõe esse estado.

O anfitrião reúne os participantes e inicia o novo quiz pelo lobby. Não há início automático que congele uma lista antes de o grupo se preparar. A nova partida recebe novos IDs de partida, fase e pergunta, com pontuação zero e sem vidas atribuídas antes da classificação. Comandos e callbacks antigos não têm efeito sobre ela.

## Continuidade de temas

A sala guarda somente o checkpoint privado da fila de quem ainda precisa escolher tema e de quem já escolheu. O retorno ao lobby extrai essa fila pelo ciclo de vida do serviço de partidas; o próximo início a entrega ao seletor de perguntas.

O algoritmo existente conserva a ordem dos participantes pendentes, remove quem não está no elenco novo e acrescenta os novos antes de repetir quem já foi atendido. Se todos os pendentes saíram, a fila contempla os novos e depois retorna aos atendidos. A final não consome uma escolha de tema. A fila não é publicada nem recebida do navegador. O histórico de perguntas recomeça por partida: não há promessa de perguntas inéditas entre revanches.

## Evidências

Testes de serviço completam duas partidas com relógio controlado na mesma sala, trocando um participante por um espectador recém-chegado. Verificam quarto colocado vencedor, ordem inversa de eliminações, perfis/sala preservados, fila continuada, pontuação e vidas novas, comandos antigos rejeitados, callback cancelado inofensivo e interrupção sem campeão.

Testes de contrato verificam resultados coerentes e rejeitam campos privados, deltas incorretos, participantes repetidos, totais divergentes e histórico publicado antes do encerramento. Testes da web conferem ordem recebida, histórico, acesso à revanche, limpeza apenas após projeção, estado descartado durante navegação e ack atrasado.

O smoke `e2e/tests/final-smoke.spec.ts` cobre duas partidas consecutivas com servidor, catálogo e relógios reais, em desktop e celular emulado. Inclui entrada de espectador no pódio, saída do anfitrião, promoção do espectador no lobby, revanche de quem foi eliminado e vitória do segundo colocado sobre o líder em pontos. Relatório e capturas ficam em `e2e/playwright-report/` e `e2e/test-results/`. Resultados executados estão na [T25](tasks/T25-podio-e-revanche.md).

Os dados continuam em memória. Voltar ao lobby descarta o resultado daquela partida; reiniciar o servidor não recupera histórico ou sala.
