# Protótipo da final no servidor

A T23 implementa a disputa de vidas com primeira resposta exclusiva em desenvolvimento/teste. O núcleo de erro e ataque manual segue as regras confirmadas. **D02 e D03 continuam em consulta**: prazo sem resposta e prazo sem alvo produzem estados explícitos de pendência, sem dano ou vitória automática. A [interface da final](final-na-web.md) foi implementada na T24; a sequência completa das cinco fases pertence às etapas posteriores.

## Entrada e contexto

Após concluir um plano isolado com classificação `ready` da T22, o anfitrião pode enviar `final:start` com `roomId` e `matchId`. O comando não recebe vidas, placar, política, ator ou horário. Empate pendente de D06 impede iniciar. O serviço usa as atribuições já congeladas de 5/4/3/2 vidas; não converte o placar novamente. O escopo permanece `isolated-prototype`, pois a classificação veio daquele plano de teste.

Antes de confirmar o início, o seletor exige perguntas fáceis/médias inéditas suficientes para as perdas possíveis das vidas iniciais: soma das vidas menos uma, distribuídas pela alternância fácil/média. Esse é um requisito de estoque, não um limite de perguntas ou critério de vitória. Falta de estoque conserva o protótipo encerrado intacto. O catálogo publicado permite testar a continuação do clássico usando, por exemplo, História e Geografia; um único tema pode não ter estoque restante suficiente. Não se criam perguntas ou pontos artificiais para permitir a final.

O serviço cria um `roundId` próprio da final, com índice de domínio 6. As ações seguintes usam esse novo contexto. Repetir `final:start` na mesma partida não reinicia a final nem restaura vidas. Produção continua sem os protótipos de partida.

## Uma única tentativa

`final.domain.ts` é puro: recebe estado, evento, tempo confiável e regras congeladas. Instruções, leitura e resposta usam o agendamento comum da sala. O prazo experimental da resposta é 15 segundos após três segundos de leitura. Abertura é inclusiva e o instante exato de encerramento já é tardio; callback atrasado não reinicia o relógio.

Na fila, o servidor valida conexão/sessão atuais, papel, participante com vidas, contexto, alternativa e prazo antes de ocupar a oportunidade. Payload inválido, espectador, eliminado e envio tardio não bloqueiam o próximo jogador válido. Um subestado interno registra o autor e fecha as tentativas antes de comparar o gabarito; o resultado é confirmado atomicamente numa transação.

Se o primeiro errar, perde exatamente uma vida e a pergunta vai para resolução. Uma resposta correta posterior não é avaliada. Se o primeiro acertar, somente ele recebe seis segundos para escolher qualquer adversário com vida. Autor, eliminado e jogador inexistente não são alvos válidos; adversário desconectado continua elegível. A escolha retira exatamente uma vida do alvo e encerra a pergunta. Não há soma de erro e ataque.

Cada resolução entra uma única vez no histórico privado, com resposta aceita e retratos de vidas antes/depois. Reenvio ou timer antigo não reaplica dano. Falha ao preparar a próxima pergunta conserva a perda já confirmada e repete somente a preparação. Pontos/acertos e a classificação de entrada permanecem históricos durante a final.

## Eliminação e encerramento

Vida zero elimina o participante e atribui ordem sequencial de eliminação. Ele permanece representado na sala e nas projeções, acompanhando sem poder responder ou atacar. O líder continua com uma vida após quatro perdas e é eliminado na quinta; segundo, terceiro e demais seguem as faixas confirmadas.

Depois da resolução, o motor prepara pergunta inédita ou declara o único sobrevivente. `podium` contém esse sobrevivente seguido da ordem inversa das eliminações; a [T25](podio-e-revanche.md) apresenta essa ordem e o histórico por fase. Não há campeão por pontos ou por atingir um número arbitrário de perguntas. Se o estoque inédito realmente terminar, a final é interrompida por `insufficient-questions`, sem inventar vencedor.

## Prazos ainda em consulta

Sem resposta, o servidor entra em `final-no-answer-pending`, identificado por **D02**. Nenhuma vida muda, nenhum gabarito é publicado e não há timer que avance silenciosamente para outra pergunta.

Se o autor do acerto não escolher alvo, entra em `final-no-target-pending`, identificado por **D03**. Conserva autor, adversários elegíveis e vidas; não sorteia nem ataca automaticamente. O gabarito já revelado após o acerto continua visível.

Esses estados suspendem o protótipo. O anfitrião pode voltar ao lobby para encerrar o teste sem campeão. Durante uma disputa ativa, retorno público ao lobby permanece bloqueado; depois de pódio ou interrupção, é permitido. Os fallbacks definitivos dependem das respostas do usuário a D02/D03 e não estão consolidados.

## Contrato e projeções

`final:start` devolve somente `stateVersion`. `answer:submit` mantém o payload existente e devolve `acceptance: "first-valid"` na final: isso confirma a prioridade, sem informar acerto ou dano no ack. `target:choose` passa a operar também sobre vidas no contexto da final; nunca aceita valor de dano enviado pelo cliente.

As visões explícitas publicam `final-instructions`, `final-question-reading`, `final-question-open`, `final-target-selection`, `final-resolution`, as duas pendências, `podium` ou interrupção. Leitura omite alternativas; pergunta aberta omite gabarito e explicação; escolha e resolução publicam a única resposta avaliada. Recibos de chegada, histórico privado, IDs editoriais e seleção ficam no servidor.

`finalRules` identifica o protótipo, informa prazos e registra D02/D03 como pendentes. `finalEntry` preserva a atribuição inicial; `finalists` informa as vidas atuais e eliminações. O progresso usa `questionCount: null` na final, representando disputa sem total fixo. Os controles e telas específicos estão descritos na [final na web](final-na-web.md).

## Verificação

Domínio e serviço cobrem 2/3/4/12 participantes, primeiro erro, dois acertos, autoria, alvo próprio/inexistente/eliminado, líder na quinta perda, sequência de eliminações, reenvio, prazo exato, callback atrasado, ausência de estoque e falha seguida de recuperação na preparação. O serviço verifica reconexão, conversão única, alvo desconectado, pendências e retorno ao lobby.

Socket.IO usa o app real com relógio de teste, em WebSocket e polling: percorre o clássico para obter classificação real, inicia a final, rejeita pacote/opção inválidos, espectador e envio no prazo exato, disputa duas respostas concorrentes, recupera a escolha em nova conexão, ataca um adversário ausente e confirma histórico/dano únicos. As duas pendências também são verificadas em rede. Evidências executadas ficam na [T23](tasks/T23-final-no-servidor.md).
