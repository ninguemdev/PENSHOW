# T23 — Final no servidor com primeira resposta exclusiva

- **Depende de:** [T14](./T14-motor-comum-de-partida.md), [T22](./T22-classificacao-e-vidas.md)
- **Pacotes:** server, shared
- **Marco:** M3
- **Branch sugerido:** `task/23-final-no-servidor`

O status desta tarefa fica somente no [índice](README.md). Caminhos de implementação citados abaixo são entregas futuras; sua menção não indica que os arquivos já existem.

## Objetivo

Implementar a disputa de vidas com uma única resposta aceita por pergunta e dano aplicado uma única vez.

## Leia antes

- [regras.md](../regras.md)
- [plano-do-jogo.md](../plano-do-jogo.md)
- [arquitetura.md](../arquitetura.md)
- [decisoes.md](../decisoes.md)

## Decisões em consulta

D02 trata de ninguém responder e D03 de ausência de alvo. O núcleo de erro/acerto é confirmado e pode avançar; resolver as duas políticas antes de considerar a final completa.

O núcleo confirmado está implementado como continuação de protótipo em desenvolvimento/teste. D02/D03 continuam em consulta; seus prazos produzem pendência explícita sem dano ou campeão automático. A tarefa permanece em andamento até consolidar essas políticas.

## Entregáveis

- [x] Na fila da sala, aceitar a primeira resposta válida e fechar a pergunta antes de avaliar o gabarito.
- [x] Em erro, retirar uma vida do autor; em acerto, autorizar somente esse ator a escolher outro participante com vida.
- [x] Aplicar uma perda ao alvo, resolver eliminação e iniciar pergunta inédita ou declarar o último sobrevivente.
- [x] Integrar prazos, autoridade de tempo, envelopes de ação e projeções sem dados privados, preservando efeito único em reenvios.
- [ ] Consolidar e integrar os fallbacks após as escolhas de D02/D03.

## Critérios de aceite

- [x] Primeiro errado seguido de outro correto produz uma perda no primeiro e nenhuma avaliação da segunda tentativa.
- [x] Duas respostas corretas concorrentes concedem um único direito de ataque.
- [x] Uma pergunta respondida não acumula erro e ataque; reenvio não restaura vidas nem duplica dano.
- [x] Alvo desconectado continua elegível se tiver vidas; eliminado ou autor do ataque não é alvo válido.
- [x] O motor não concede vitória por placar ao atingir um limite arbitrário de perguntas.

## Verificação

- [x] Integrar respostas concorrentes, resposta exatamente no prazo, pacote inválido e tentativa de espectador.
- [x] Testar líder com quatro perdas e quinta eliminação, ataque repetido e alvo já eliminado.
- [x] Testar suspensão sem dano por ausência de resposta/alvo enquanto D02/D03 estão pendentes.
- [ ] Validar os fallbacks definitivos após as decisões.

## Implementação e evidências do núcleo

`final.domain.ts` implementa instruções, leitura, disputa exclusiva, escolha de alvo, resolução, eliminação, sobrevivente e interrupção. Registra um subestado interno de resposta ocupada antes de comparar o gabarito. Cada erro ou ataque confirma um único dano e histórico; ausência de conteúdo interrompe sem campeão. Timers usam contexto/pergunta/revisão, e preparação com falha retoma sem recalcular perda.

`final:start` só aceita contexto de partida e exige anfitrião, protótipo concluído, classificação T22 pronta e estoque suficiente. Conserva vidas iniciais, pontos/acertos históricos e escopo `isolated-prototype`. Repetir o início não reinicia vidas. `answer:submit` confirma `first-valid`; `target:choose` retira uma vida do adversário ativo escolhido pelo autor do acerto, mesmo se o alvo estiver desconectado. Identidade, papel, fase e prazo são revalidados na fila.

As projeções explícitas omitem recibos, gabarito antecipado, IDs editoriais e seleção. Publicam vidas atuais, a única resolução e progresso com `questionCount: null`, sem teto artificial de perguntas. `final-no-answer-pending` e `final-no-target-pending` representam D02/D03 sem fallback; o anfitrião pode encerrar esses testes voltando ao lobby. A UI da final permanece na T24.

Em 19/10/2026, `pnpm test` passou com **371 testes do servidor, 169 de shared, 109 da web, 32 de conteúdo e 5 de artes**, total **686**. Lint, tipagem e build passaram. Os testes cobrem 2/3/4/12 participantes, líder eliminado só na quinta perda, dano único, concorrência, inválidos, prazo exato, alvo ausente/eliminado, reconexão, estoque e falha de preparação seguida de retomada.

Socket.IO percorre seis perguntas reais do catálogo publicado para obter classificação, inicia a final e verifica WebSocket/polling: pacote e opção inválidos, espectador, resposta no prazo exato, primeiro erro seguido de acerto rejeitado, dois acertos concorrentes, um único ataque, conexão substituta com prazo preservado e alvo desconectado. As duas pendências também foram exercitadas em rede. A matriz de navegador não foi repetida nesta etapa de servidor; final com interface real será verificada na T24.

Guia: [final-no-servidor.md](../final-no-servidor.md). D02/D03 e D06 continuam em consulta, sem alterar `PENDING_DECISIONS` ou `decisoes.md`. Não há cache de ack por `actionId`; o domínio impede reaplicação do efeito mesmo com outro ID, e robustez de ações/frequência continua nas tarefas posteriores.

## Cuidados de implementação

Recepção e desempate técnico de concorrência pertencem ao servidor. Nunca aceitar timestamp do cliente como prova de ter respondido antes.

Aplicar as [convenções e verificações comuns](README.md#convenções-de-implementação). Registrar evidências reais; checklist não substitui execução ou revisão.
