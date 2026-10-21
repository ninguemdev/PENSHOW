# Protótipo de roubo de pontos

A T20 acrescenta `theftStrategy`, `theft-target-selection`, escolha de alvo e **Iniciar roubo de teste** ao lobby em desenvolvimento/teste. São seis perguntas aprovadas inéditas, duas por dificuldade, com regras congeladas por partida. Ainda não há sequência completa ou final.

**D05 continua em consulta.** O comportamento implementado exercita somente a proposta `first-correct-only`, marcada como protótipo nas regras e na interface. A consolidação depende da escolha do usuário sobre quem pode roubar; testes não representam aprovação da regra.

## Fluxo e pontos

Todos respondem. Cada acerto ganha a base experimental de **100 pontos**. Enquanto houver respostas abertas, autor do roubo, gabarito e pontos da pergunta permanecem ocultos. Depois de todos responderem ou do prazo, a primeira resposta correta na ordem da fila conquista a escolha; uma errada anterior não a bloqueia. Empates no mesmo milissegundo conservam a ordem efetiva da fila.

Os acertos são creditados antes da escolha de alvo. Se houver primeiro acerto e outro participante com saldo positivo, somente esse autor recebe **seis segundos** para escolher adversário elegível. Sem acerto ou adversário com saldo, a pergunta revela diretamente. Sem escolha no prazo, permanecem somente os créditos de acerto.

| Situação | Resultado |
|---|---|
| Ambos acertam partindo de zero; primeiro escolhe o outro | Primeiro termina em 150, alvo em 50 |
| Alvo tem 30 e erra | Transfere só 30; alvo termina em zero |
| Alvo tinha 30 e acerta | Recebe 100, transfere 50 e termina em 80 |
| Autor não escolhe no prazo | Nenhuma transferência |

`transferPoints` limita a transferência ao menor entre o parâmetro de **50** e o saldo disponível. Crédito e débito têm o mesmo valor efetivo; apenas o acerto cria pontos. O saldo nunca fica negativo. A modalidade não usa dano de vidas ou a política de primeira resposta exclusiva da final.

## Resolução e efeitos únicos

`theftStrategy.resolve` usa a T13 para calcular os créditos uma vez. O motor guarda a resolução pendente e o placar após os créditos no subestado de alvo, sem registrar ainda uma pergunta concluída. `settleTarget` aplica somente a transferência sobre esse resultado, preservando os efeitos da base e o placar original. A revelação confirma uma única resolução completa no histórico. O timeout finaliza sem recalcular os acertos.

Escolha própria, jogador inexistente ou participante sem saldo é `INVALID_TARGET`; ator diferente do primeiro acerto é `FORBIDDEN`. O prazo exato já está encerrado. Sessão/conexão atuais e contexto completo são revalidados na fila. O cliente não informa valor transferido, dano, saldo ou horário.

Reenvio após liquidar é recusado por fase/contexto e não transfere novamente. Falha antes do commit mantém créditos e escolha pendente para nova tentativa dentro do prazo. Timers antigos não reaplicam resultado. Reconexão conserva autor, alvos e prazo original.

## Contrato e interface

`match:start` aceita `mode: "theft"`, congelado no elenco. O seletor usa `theft-prototype`, sem reserva da final. O índice de domínio é 4 e o progresso do plano isolado é fase 1 de 1. Produção permanece sem os protótipos de partida.

`MatchView.theftRules` publica base, máximo, prazo de alvo, política `first-correct-only` e `status: "prototype"`. O subestado de alvo publica pergunta por ID, autor, adversários elegíveis e prazo; gabarito e recibos continuam privados. O schema exige alvos com saldo após os créditos.

Na revelação, `theftResult` inclui autor, alvo (ou `null`), valor efetivo e decomposição por participante: saldo anterior, acerto, transferência com sinal e saldo atual. O schema confere participantes, saldo final, soma dos componentes e correspondência entre transferência e valor. A UI renderiza os valores recebidos e identifica **Roubo** nos efeitos.

O controle de alvo usa botões nativos por teclado/toque, somente para o autor. Outros jogadores e espectadores acompanham. A store bloqueia envios concorrentes e mantém uma escolha incerta bloqueada até recuperar a fotografia; não repete ataques automaticamente. Leitura, resposta e revelação usam componentes comuns.

## Verificação

Domínio cobre erro rápido, ordens no mesmo milissegundo, ausência de acertos, saldo 30, saldo após crédito, timeout, ator/alvo inválidos, prazo exato, repetição e conservação da transferência. Serviço cobre seis perguntas reais, concorrência, reconexão, timer antigo e rollback. Socket.IO cobre WebSocket/polling, espectadores, outra identidade, campo injetado, substituição da conexão e liquidação **150/50**.

Web cobre início, instrução, teclado, autorização, decomposição e confirmação incerta. `theft-smoke.spec.ts` percorre seis perguntas em desktop/celular emulado, com erro rápido, nenhum acerto, timeout, troca do autor, recarga no alvo e retorno ao lobby. O resultado esperado é **400/400** com **4/4 acertos**. Evidências ficam na [T20](tasks/T20-fase-roubo.md).
